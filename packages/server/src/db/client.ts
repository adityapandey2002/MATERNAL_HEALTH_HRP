import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "./types.js";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://hrp:hrp_dev@localhost:5432/hrp",
    max: 10,
  }),
});

export const db = new Kysely<DB>({ dialect });

export async function closeDb() {
  await db.destroy();
}
