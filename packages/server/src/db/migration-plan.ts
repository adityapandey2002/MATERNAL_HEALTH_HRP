import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

export interface Migration {
  id: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  id: string;
  checksum: string;
}

export function normalizeSql(sql: string): string {
  return sql.replace(/\r\n/g, "\n");
}

export function checksumSql(sql: string): string {
  return createHash("sha256").update(normalizeSql(sql)).digest("hex");
}

export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const filenames = (await readdir(dir)).filter((name) => MIGRATION_FILE.test(name)).sort();

  if (filenames.length === 0) {
    throw new Error(`No migrations found in ${dir}`);
  }

  return Promise.all(
    filenames.map(async (filename) => {
      const raw = await readFile(path.join(dir, filename), "utf8");
      const sql = normalizeSql(raw);

      return {
        id: filename.replace(/\.sql$/, ""),
        filename,
        sql,
        checksum: checksumSql(sql),
      };
    })
  );
}

export function planMigrations(migrations: Migration[], applied: AppliedMigration[]): Migration[] {
  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const appliedIds = new Set<string>();

  for (const record of applied) {
    const migration = byId.get(record.id);
    if (!migration) {
      throw new Error(`Applied migration ${record.id} is missing from the migrations directory`);
    }
    if (migration.checksum !== record.checksum) {
      throw new Error(`Checksum drift detected for migration ${record.id}`);
    }
    appliedIds.add(record.id);
  }

  return migrations.filter((migration) => !appliedIds.has(migration.id));
}
