import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checksumSql, loadMigrations, planMigrations } from "./migration-plan.js";

const tempDirs: string[] = [];

async function makeMigrations(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hrp-migrations-"));
  tempDirs.push(dir);
  await Promise.all(
    Object.entries(files).map(([name, contents]) => writeFile(path.join(dir, name), contents))
  );
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("migration plan", () => {
  it("loads migrations in numeric order with checksums", async () => {
    const dir = await makeMigrations({
      "002_second.sql": "select 2;",
      "001_first.sql": "select 1;",
      "README.md": "ignored",
    });

    const migrations = await loadMigrations(dir);

    expect(migrations.map((migration) => migration.id)).toEqual(["001_first", "002_second"]);
    expect(migrations[0]?.checksum).toHaveLength(64);
  });

  it("normalizes line endings before checksumming", async () => {
    const dir = await makeMigrations({
      "001_first.sql": "select 1;\r\nselect 2;\r\n",
    });

    const [migration] = await loadMigrations(dir);

    expect(migration?.checksum).toBe(checksumSql("select 1;\nselect 2;\n"));
  });

  it("rejects checksum drift for an applied migration", async () => {
    const dir = await makeMigrations({ "001_first.sql": "select 1;" });
    const [migration] = await loadMigrations(dir);

    expect(() =>
      planMigrations(migrationsOrThrow(migration), [{ id: "001_first", checksum: "different" }])
    ).toThrow(/Checksum drift/);
  });

  it("rejects an applied migration that no longer exists", async () => {
    const dir = await makeMigrations({ "001_first.sql": "select 1;" });
    const migrations = await loadMigrations(dir);

    expect(() => planMigrations(migrations, [{ id: "009_missing", checksum: "checksum" }])).toThrow(
      /missing from the migrations directory/
    );
  });

  it("returns only pending migrations", async () => {
    const dir = await makeMigrations({
      "001_first.sql": "select 1;",
      "002_second.sql": "select 2;",
    });
    const migrations = await loadMigrations(dir);

    const pending = planMigrations(migrations, [
      { id: "001_first", checksum: migrations[0]?.checksum ?? "" },
    ]);

    expect(pending.map((migration) => migration.id)).toEqual(["002_second"]);
  });

  it("ships the baseline, scope-index and authorization migrations", async () => {
    const migrations = await loadMigrations();

    expect(migrations.map((migration) => migration.id)).toEqual([
      "001_baseline",
      "002_scope_indexes",
      "003_authz_foundation",
    ]);
  });
});

function migrationsOrThrow<T>(migration: T | undefined): T[] {
  if (!migration) throw new Error("Expected a migration fixture");
  return [migration];
}
