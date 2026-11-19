#!/usr/bin/env node
/**
 * Read-only inspector for the pilot Postgres database.
 *
 * The Neon (or Render) web console talks to the provider's API from your
 * browser, so it can show "Error connecting to database: Failed to fetch" while
 * the database itself is perfectly healthy. This script connects with the same
 * `DATABASE_URL` the API uses and prints what an operator needs:
 *
 *   npm run db:inspect
 *   npm run db:inspect -- --table=users --limit=10
 *   npm run db:inspect -- --table=patients --show-pii
 *   npm run db:inspect -- --json
 *
 * Every query runs inside `BEGIN TRANSACTION READ ONLY`, so it cannot modify
 * data. Names, phone numbers and free text are masked unless `--show-pii` is
 * passed; the connection string is never printed.
 *
 * Required: DATABASE_URL=postgresql://user:password@host/db?sslmode=require
 */

import pg from "pg";

/** Tables an operator may sample; anything else is refused. */
const SAMPLEABLE_TABLES = {
  facilities: "created_at",
  users: "created_at",
  patients: "created_at",
  visits: "created_at",
  follow_ups: "scheduled_date",
  referrals: "created_at",
  supervision_alerts: "created_at",
  sync_queue: "created_at",
  devices: "created_at",
  responsibilities: "created_at",
  user_nodal_designations: "created_at",
  field_level_lists: "created_at",
  schema_migrations: "applied_at",
};

const COUNTED_TABLES = [
  "facilities",
  "users",
  "patients",
  "visits",
  "follow_ups",
  "referrals",
  "supervision_alerts",
  "sync_queue",
  "devices",
];

/** Columns masked in a sample unless --show-pii is passed. */
const PII_COLUMNS = new Set([
  "name",
  "phone",
  "email",
  "address",
  "abha_id",
  "asha_name",
  "asha_phone",
  "notes",
  "password_hash",
  "label",
]);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 20;

const HINTS = {
  ENOTFOUND:
    "The host name in DATABASE_URL does not resolve. Check the host, your DNS/VPN, and that the database project still exists.",
  EAI_AGAIN:
    "DNS lookup failed (temporary). Retry, and check whether a VPN or DNS filter is intercepting queries.",
  ECONNREFUSED:
    "The host resolved but refused the connection. The database may be stopped, or a firewall is blocking the port.",
  ETIMEDOUT:
    "The connection timed out. The database may be suspended, or the network path is blocked.",
  ECONNRESET: "The connection was reset. A proxy or firewall is dropping the TLS handshake.",
  "28P01": "Password authentication failed. The credentials in DATABASE_URL are stale.",
  28000:
    "The server rejected the login (missing role or IP allow-list). Check the database user and its network rules.",
  "3D000": "The database named in DATABASE_URL does not exist on that server.",
  "57P03":
    "The server cannot accept connections yet. A Neon free project starts on demand: open it once in the console, then retry.",
  53300: "Too many open connections. Close other clients or raise the pool limit.",
};

function fail(message, hint) {
  console.error(`\n${message}`);
  if (hint) console.error(`\nHint: ${hint}`);
  process.exit(1);
}

function usage() {
  console.log(`Read-only inspector for the pilot database.

Usage:
  DATABASE_URL=postgresql://... node scripts/db-inspect.mjs [options]

Options:
  --table=<name>   Sample rows from one table (default: summary only)
  --limit=<n>      Rows to sample, 1-${MAX_LIMIT} (default: ${DEFAULT_LIMIT})
  --show-pii       Print names, phone numbers and free text unmasked
  --json           Print the summary as JSON
  --help           Show this message

Sampleable tables:
  ${Object.keys(SAMPLEABLE_TABLES).join(", ")}`);
}

function parseArgs(argv) {
  const options = { table: null, limit: DEFAULT_LIMIT, showPii: false, json: false };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--show-pii") {
      options.showPii = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg.startsWith("--table=")) {
      options.table = arg.slice("--table=".length);
    } else if (arg.startsWith("--limit=")) {
      const limit = Number.parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isFinite(limit) || limit < 1)
        fail(`--limit must be a number from 1 to ${MAX_LIMIT}`);
      options.limit = Math.min(limit, MAX_LIMIT);
    } else {
      fail(`Unknown argument: ${arg}`, "Run with --help to see the options.");
    }
  }

  if (options.table !== null && !(options.table in SAMPLEABLE_TABLES)) {
    fail(
      `Refusing to sample "${options.table}".`,
      `Choose one of: ${Object.keys(SAMPLEABLE_TABLES).join(", ")}`
    );
  }

  return options;
}

/** Host and database from the URL, without the credentials. */
function describeTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return { host: url.hostname, database: url.pathname.replace(/^\//, "") || "(default)" };
  } catch {
    return { host: "(unparsable DATABASE_URL)", database: "?" };
  }
}

function maskText(value) {
  const text = String(value);
  if (text.length <= 2) return "*".repeat(text.length);
  return `${text[0]}${"*".repeat(Math.max(1, text.length - 2))}${text[text.length - 1]}`;
}

function maskPhone(value) {
  const digits = String(value);
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

function maskColumn(column, value) {
  if (value === null || value === undefined) return value;
  if (column === "phone" || column === "asha_phone") return maskPhone(value);
  if (column === "email") {
    const text = String(value);
    const at = text.indexOf("@");
    if (at <= 0) return maskText(text);
    return `${maskText(text.slice(0, at))}${text.slice(at)}`;
  }
  if (column === "password_hash") return "[redacted]";
  return maskText(value);
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 16);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 36 ? `${text.slice(0, 33)}...` : text;
}

function printTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => formatCell(row[index]).length))
  );
  const line = (cells) =>
    cells
      .map((cell, index) => formatCell(cell).padEnd(widths[index]))
      .join("  ")
      .trimEnd();

  console.log(`  ${line(headers)}`);
  console.log(`  ${widths.map((width) => "-".repeat(width)).join("  ")}`);
  for (const row of rows) console.log(`  ${line(row)}`);
}

async function scalar(client, sql) {
  const result = await client.query(sql);
  const row = result.rows[0] ?? {};
  const value = Object.values(row)[0];
  return value;
}

async function summary(client, target) {
  const counts = {};
  for (const table of COUNTED_TABLES) {
    counts[table] = Number(await scalar(client, `select count(*)::int as n from ${table}`));
  }

  const levels = (
    await client.query(
      "select level, count(*)::int as n from facilities group by level order by count(*) desc"
    )
  ).rows.map((row) => ({ level: row.level, count: Number(row.n) }));

  const facilityPaths = (
    await client.query(
      `select f.path,
              f.level,
              (select count(*) from users u where u.facility_id = f.id)::int as staff,
              (select count(*) from patients p where p.facility_id = f.id)::int as patients
         from facilities f
        where f.level in ('DISTRICT', 'BLOCK')
        order by f.path`
    )
  ).rows.map((row) => ({
    path: row.path,
    level: row.level,
    staff: Number(row.staff),
    patients: Number(row.patients),
  }));

  const flatPaths = Number(
    await scalar(
      client,
      "select count(*)::int as n from facilities where position('.' in path) = 0"
    )
  );

  const roles = (
    await client.query("select role, count(*)::int as n from users group by role order by role")
  ).rows.map((row) => ({ role: row.role, count: Number(row.n) }));

  const activity = {
    lastPatient: await scalar(client, "select max(created_at) as t from patients"),
    lastVisit: await scalar(client, "select max(created_at) as t from visits"),
    lastFollowUp: await scalar(client, "select max(completed_at) as t from follow_ups"),
    openFollowUps: Number(
      await scalar(
        client,
        "select count(*)::int as n from follow_ups where status = 'PENDING' and scheduled_date < now()"
      )
    ),
    lastSyncPush: await scalar(client, "select max(created_at) as t from sync_queue"),
  };

  const migrations = (
    await client.query(
      "select id, applied_at from schema_migrations order by applied_at desc limit 6"
    )
  ).rows.map((row) => ({ id: row.id, appliedAt: row.applied_at }));

  return { target, counts, levels, facilityPaths, flatPaths, roles, activity, migrations };
}

function printSummary(report) {
  console.log("\nMatru Suraksha — pilot database");
  console.log(`  Host: ${report.target.host}   Database: ${report.target.database}`);

  console.log("\nTables");
  for (const [table, count] of Object.entries(report.counts)) {
    console.log(`  ${table.padEnd(20)} ${count}`);
  }

  console.log("\nFacilities by level");
  console.log(
    `  ${report.levels.map((row) => `${row.level} ${row.count}`).join("   ") || "(none)"}`
  );

  console.log("\nFacility paths (what BHM and DHS scope on)");
  if (report.facilityPaths.length === 0) {
    console.log("  (no block or district rows)");
  } else {
    printTable(
      ["path", "level", "staff", "patients"],
      report.facilityPaths.map((row) => [row.path, row.level, row.staff, row.patients])
    );
  }
  if (report.flatPaths > 0) {
    console.log(
      `\n  ! ${report.flatPaths} facilities still have a flat path. Migration 009 has not been applied: deploy the server again.`
    );
  } else {
    console.log("  All facility paths are hierarchical (migration 009 applied).");
  }

  console.log("\nAccounts by role");
  console.log(`  ${report.roles.map((row) => `${row.role} ${row.count}`).join("   ") || "(none)"}`);

  console.log("\nActivity");
  console.log(`  last patient        ${formatCell(report.activity.lastPatient) || "(none)"}`);
  console.log(`  last visit          ${formatCell(report.activity.lastVisit) || "(none)"}`);
  console.log(`  last follow-up done ${formatCell(report.activity.lastFollowUp) || "(none)"}`);
  console.log(`  overdue follow-ups  ${report.activity.openFollowUps}`);
  console.log(`  last sync push      ${formatCell(report.activity.lastSyncPush) || "(none)"}`);

  console.log("\nMigrations (newest 6)");
  for (const migration of report.migrations) {
    console.log(`  ${formatCell(migration.appliedAt).padEnd(18)} ${migration.id}`);
  }
  console.log("");
}

async function sample(client, table, limit, showPii) {
  const orderBy = SAMPLEABLE_TABLES[table];
  const result = await client.query(
    `select * from ${table} order by ${orderBy} desc nulls last limit $1`,
    [limit]
  );

  console.log(`\n${table} — ${result.rows.length} row(s), newest first`);
  if (result.rows.length === 0) {
    console.log("  (empty)\n");
    return;
  }

  const headers = Object.keys(result.rows[0]);
  const rows = result.rows.map((row) =>
    headers.map((column) =>
      !showPii && PII_COLUMNS.has(column) ? maskColumn(column, row[column]) : row[column]
    )
  );

  printTable(headers, rows);
  if (!showPii) {
    console.log("\n  Names, phone numbers and free text are masked. Add --show-pii to see them.");
  }
  console.log("");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    fail(
      "DATABASE_URL is not set.",
      "Copy it from Render (hrp-pilot-api -> Environment) or the Neon dashboard, then run again."
    );
  }

  const target = describeTarget(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15_000,
    // Mirrors packages/server/src/db/client.ts so this uses the same TLS mode
    // as the API: the URL carries sslmode and the CA is the system trust store.
    ssl:
      connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify")
        ? { rejectUnauthorized: true }
        : undefined,
  });

  let client;
  try {
    client = await pool.connect();
    await client.query("begin transaction read only");

    if (options.json) {
      const report = await summary(client, target);
      console.log(JSON.stringify(report, null, 2));
    } else if (options.table) {
      await sample(client, options.table, options.limit, options.showPii);
    } else {
      const report = await summary(client, target);
      printSummary(report);
    }

    await client.query("rollback");
  } catch (error) {
    const code = error?.code;
    const hint =
      HINTS[code] ??
      (String(error?.message ?? "")
        .toLowerCase()
        .includes("timeout")
        ? "The connection timed out. The database may be suspended or unreachable from this network."
        : "Check DATABASE_URL, your network, and whether the database project is running.");
    fail(
      `Could not read the database: ${error?.message ?? error}${code ? ` (${code})` : ""}`,
      hint
    );
  } finally {
    client?.release();
    await pool.end();
  }
}

await main();
