#!/usr/bin/env node
/**
 * Verifies a pg_dump custom-format backup without touching production.
 *
 * Required:
 *   BACKUP_FILE=/path/to/hrp.dump
 *
 * Optional restore drill (requires ALLOW_RESTORE_DRILL=true):
 *   RESTORE_DATABASE_URL=postgresql://.../hrp_restore
 *
 * The restore database name must contain "restore", "drill", or "verify".
 * No connection strings or row-level data are printed.
 */

import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MIN_BYTES = 1024;
const MIN_TABLES = 8;

function fail(message) {
  console.error(`Backup verification failed: ${message}`);
  process.exit(1);
}

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) fail(`${label} could not run: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().split("\n").slice(-3).join(" ");
    fail(`${label} exited with ${result.status}: ${detail}`);
  }
  return result.stdout;
}

const file = process.env.BACKUP_FILE;
if (!file) fail("BACKUP_FILE is required");
if (!existsSync(file)) fail(`backup file does not exist: ${file}`);

const stats = statSync(file);
if (stats.size < MIN_BYTES) fail(`backup file is suspiciously small (${stats.size} bytes)`);

run("pg_restore", ["--version"], "pg_restore");
const toc = run("pg_restore", ["--list", file], "pg_restore --list");
const tableEntries = toc.split("\n").filter((line) => line.includes(" TABLE DATA "));

if (tableEntries.length < MIN_TABLES) {
  fail(
    `archive contains ${tableEntries.length} table data entries; expected at least ${MIN_TABLES}`
  );
}

const restoreUrl = process.env.RESTORE_DATABASE_URL;
if (restoreUrl) {
  if (process.env.ALLOW_RESTORE_DRILL !== "true") {
    fail("set ALLOW_RESTORE_DRILL=true to run a restore drill");
  }

  const databaseName = new URL(restoreUrl).pathname.replace(/^\//, "");
  if (!/restore|drill|verify/i.test(databaseName)) {
    fail("RESTORE_DATABASE_URL must target a database containing restore, drill, or verify");
  }

  run(
    "pg_restore",
    ["--dbname", restoreUrl, "--clean", "--if-exists", "--no-owner", "--no-privileges", file],
    "pg_restore restore drill"
  );

  const counts = run(
    "psql",
    [
      restoreUrl,
      "-tAc",
      "select (select count(*) from facilities), (select count(*) from users), (select count(*) from patients)",
    ],
    "restore smoke query"
  ).trim();

  console.log(`Restore drill completed. Counts (facilities, users, patients): ${counts}`);
} else {
  console.log("Archive validated. Restore drill skipped because RESTORE_DATABASE_URL is not set.");
}

console.log(`Backup verified: ${tableEntries.length} table data entries, ${stats.size} bytes.`);
