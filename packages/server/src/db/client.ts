import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { config } from "../config.js";
import type { DB } from "./types.js";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
  }),
});

export const db = new Kysely<DB>({ dialect });

export async function closeDb() {
  await db.destroy();
}
