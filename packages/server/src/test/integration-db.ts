import { type Kysely, sql } from "kysely";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import type { DB } from "../db/types.js";

const POSTGRES_IMAGE = "postgres:16-alpine";
const POSTGRES_PORT = 5432;
const POSTGRES_USER = "hrp_test";
const POSTGRES_PASSWORD = "hrp_test_password";
const POSTGRES_DB = "hrp_test";
const CONTAINER_STARTUP_TIMEOUT_MS = 180_000;

const TEST_JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const TEST_JWT_REFRESH_SECRET = "integration-test-refresh-secret-0123456789abcdef";

export interface IntegrationDatabase {
  db: Kysely<DB>;
  databaseUrl: string;
  containerStartupMs: number;
}

let contextPromise: Promise<IntegrationDatabase> | undefined;
let database: Kysely<DB> | undefined;
let container: StartedTestContainer | undefined;

async function start(): Promise<IntegrationDatabase> {
  const startedAt = performance.now();
  const started = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_DB,
    })
    .withExposedPorts(POSTGRES_PORT)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
    .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
    .start();

  container = started;
  const containerStartupMs = Math.round(performance.now() - startedAt);
  const databaseUrl = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${started.getHost()}:${started.getMappedPort(POSTGRES_PORT)}/${POSTGRES_DB}`;

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;

  await import("../config.js");
  const { db } = await import("../db/client.js");
  const { migrate } = await import("../db/migrate.js");
  await migrate();

  database = db;
  console.info(`integration-db: postgres container ready in ${containerStartupMs}ms`);

  return { db, databaseUrl, containerStartupMs };
}

export async function startIntegrationDb(): Promise<IntegrationDatabase> {
  contextPromise ??= start();
  return contextPromise;
}

export function getIntegrationDb(): Kysely<DB> {
  if (!database) {
    throw new Error("Integration database has not been started");
  }
  return database;
}

export async function resetIntegrationDb(): Promise<void> {
  const db = getIntegrationDb();
  await sql`
    truncate table
      responsibilities,
      supervision_alerts,
      sync_queue,
      referrals,
      visits,
      patients,
      users,
      facilities
    restart identity cascade
  `.execute(db);
}

export async function stopIntegrationDb(): Promise<void> {
  const pending = contextPromise;
  contextPromise = undefined;

  if (pending) {
    const context = await pending;
    await context.db.destroy();
    database = undefined;
  }

  const running = container;
  container = undefined;
  if (running) {
    await running.stop();
  }
}
