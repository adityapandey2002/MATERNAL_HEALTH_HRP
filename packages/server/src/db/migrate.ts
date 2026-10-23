import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { sql } from "kysely";
import { config } from "../config.js";
import { db } from "./client.js";
import { loadMigrations, planMigrations } from "./migration-plan.js";

export async function migrate(): Promise<void> {
  const migrations = await loadMigrations();

  await db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(${config.dbMigrationLockId})`.execute(trx);

    await sql`
      create table if not exists schema_migrations (
        id varchar(255) primary key,
        checksum varchar(64) not null,
        applied_at timestamptz not null default now()
      )
    `.execute(trx);

    const applied = await trx.selectFrom("schema_migrations").select(["id", "checksum"]).execute();
    const pending = planMigrations(migrations, applied);

    if (pending.length === 0) {
      console.info("No pending migrations");
      return;
    }

    for (const migration of pending) {
      const started = performance.now();
      await sql.raw(migration.sql).execute(trx);
      await trx
        .insertInto("schema_migrations")
        .values({ id: migration.id, checksum: migration.checksum })
        .execute();
      const duration = Math.round(performance.now() - started);
      console.info(`Applied migration ${migration.id} in ${duration}ms`);
    }
  });
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    await migrate();
  } finally {
    await db.destroy();
  }
}
