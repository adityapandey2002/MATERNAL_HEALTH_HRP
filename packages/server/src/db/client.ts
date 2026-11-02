import { Kysely, PostgresDialect } from "kysely";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { config } from "../config.js";
import type { DB } from "./types.js";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    // CockroachDB Serverless requires SSL. The connection string may include
    // sslmode; if it uses verify-full, set DB_SSL_CA to the downloaded cert.
    ssl: config.dbSslCa
      ? { ca: readFileSync(config.dbSslCa), rejectUnauthorized: true }
      : config.databaseUrl.includes("sslmode=require") ||
          config.databaseUrl.includes("sslmode=verify")
        ? { rejectUnauthorized: false }
        : undefined,
  }),
});

export const db = new Kysely<DB>({ dialect });

export async function closeDb() {
  await db.destroy();
}
