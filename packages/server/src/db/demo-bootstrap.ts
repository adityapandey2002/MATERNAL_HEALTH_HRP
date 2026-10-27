import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client.js";
import { seedDatabase } from "./seed.js";

export type DemoBootstrapOutcome = "disabled" | "already-populated" | "seeded";

export interface DemoBootstrapDeps {
  env: Record<string, string | undefined>;
  countUsers: () => Promise<number>;
  truncateDatabase: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  log: (message: string) => void;
}

async function countUsersInDatabase(): Promise<number> {
  const row = await db
    .selectFrom("users")
    .select((eb) => eb.fn.count("users.id").as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function truncateDatabase(): Promise<void> {
  await db.deleteFrom("responsibilities").execute();
  await db.deleteFrom("sync_queue").execute();
  await db.deleteFrom("supervision_alerts").execute();
  await db.deleteFrom("referrals").execute();
  await db.deleteFrom("visits").execute();
  await db.deleteFrom("patients").execute();
  await db.deleteFrom("users").execute();
  await db.deleteFrom("facilities").execute();
}

/**
 * Loads the synthetic demo dataset once, on a database that has no users yet.
 * This is deliberately narrower than `db:seed`: it can never wipe existing
 * users because it only runs against an empty users table, and it requires the
 * explicit SEED_DEMO_DATA=true opt-in.
 *
 * RESET_DEMO_DATA=true (also requires SEED_DEMO_DATA=true) is the only path
 * that truncates first. It exists for demo operations; leave it unset in
 * normal operation so a restart can never destroy data.
 */
export async function bootstrapDemoData(
  overrides: Partial<DemoBootstrapDeps> = {}
): Promise<DemoBootstrapOutcome> {
  const env = overrides.env ?? process.env;
  const countUsers = overrides.countUsers ?? countUsersInDatabase;
  const truncate = overrides.truncateDatabase ?? truncateDatabase;
  const seedDemoData = overrides.seedDemoData ?? seedDatabase;
  const log = overrides.log ?? ((message: string) => console.log(message));

  if (env.SEED_DEMO_DATA !== "true") {
    log("[bootstrap] SEED_DEMO_DATA is not true; skipping demo data");
    return "disabled";
  }

  const resetDemoData = env.RESET_DEMO_DATA === "true";

  if (resetDemoData) {
    log("[bootstrap] RESET_DEMO_DATA=true; truncating and reloading synthetic demo data");
    await truncate();
    await seedDemoData();
    return "seeded";
  }

  const userCount = await countUsers();
  if (userCount > 0) {
    log(`[bootstrap] database already has ${userCount} user(s); skipping demo data`);
    return "already-populated";
  }

  log("[bootstrap] empty database; loading synthetic demo data");
  await seedDemoData();
  return "seeded";
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    await bootstrapDemoData();
  } finally {
    await db.destroy();
  }
}
