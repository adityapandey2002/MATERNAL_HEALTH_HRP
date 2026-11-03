import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "../db/types.js";

/**
 * Device registry.
 *
 * The field app keeps a full copy of its cohort on the phone, so the server
 * needs a handle on the install that holds those records. A device registers
 * itself with a client-generated UUID on sign-in and is checked on every
 * authenticated request that carries the header. Revoking the row is what
 * makes a lost phone stop syncing; the app then wipes its local database.
 */

export const DEVICE_HEADER = "x-device-id";

export type DevicePlatform = "web" | "android";

/**
 * Shape check for ids that reach a `uuid` column. Anything else is ignored
 * rather than forwarded to Postgres, where a malformed uuid aborts the query.
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export function parsePlatform(value: unknown): DevicePlatform {
  return value === "android" ? "android" : "web";
}

export interface RegisterDeviceInput {
  deviceId: string;
  userId: string;
  platform: DevicePlatform;
  label?: string | null;
}

/**
 * Upsert the install and stamp it as active.
 *
 * A device the district has already revoked stays revoked: the `where` clause
 * skips the update, so signing in again on a blocked phone cannot restore it.
 * The row keeps its original `created_at` and `revoked_at` either way.
 */
export async function registerDevice(
  executor: Kysely<DB>,
  input: RegisterDeviceInput
): Promise<void> {
  await executor
    .insertInto("devices")
    .values({
      id: input.deviceId,
      user_id: input.userId,
      platform: input.platform,
      label: input.label ?? null,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        user_id: input.userId,
        platform: input.platform,
        last_seen_at: sql<Date>`now()`,
      })
    )
    .execute();
}

/** True when this install has been revoked by a supervisor. */
export async function isDeviceRevoked(executor: Kysely<DB>, deviceId: string): Promise<boolean> {
  const row = await executor
    .selectFrom("devices")
    .select("revoked_at")
    .where("id", "=", deviceId)
    .executeTakeFirst();

  return Boolean(row?.revoked_at);
}

/**
 * Mark a device revoked. Repeating the call keeps the first revocation time so
 * the audit trail shows when access actually ended.
 */
export async function revokeDevice(executor: Kysely<DB>, deviceId: string): Promise<void> {
  await executor
    .updateTable("devices")
    .set({ revoked_at: sql<Date>`coalesce(revoked_at, now())` })
    .where("id", "=", deviceId)
    .execute();
}
