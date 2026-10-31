import { nextHrpFollowUpDate } from "@hrp/shared";
import type { UserRole } from "@hrp/shared";
import { type Insertable, type Kysely, sql } from "kysely";
import type { DB } from "../db/types.js";

/**
 * Assignment rules for the repeating 15-day HRP follow-up cycle.
 *
 * A referred HRP starts with the Block HRP Helpdesk; if no block helpdesk
 * account can see the patient, the BHM of that block owns the first cycle and
 * the registering worker is the final fallback. Every other cycle belongs to
 * the registering ANM/CHO.
 */

export type FollowUpLevel = "BLOCK_NODAL" | "CHO" | "ANM";
export type FollowUpTrack = "BLOCK_15_DAY" | "FIELD_15_DAY";

export interface FollowUpOwner {
  userId: string;
  level: FollowUpLevel;
}

/** The clinical tier a role works at on a follow-up row. */
export function followUpLevelForRole(role: UserRole | string | null | undefined): FollowUpLevel {
  if (role === "ANM") return "ANM";
  if (role === "CHO") return "CHO";
  return "BLOCK_NODAL";
}

/**
 * The row that starts the next 15-day window once a cycle is completed.
 * The registrant owns it; a CHO registrant keeps the CHO tier label.
 */
export function nextFieldFollowUpValues(input: {
  patientId: string;
  registrantUserId: string;
  registrantRole: string | null | undefined;
  assignedByUserId: string;
  completedAt: Date;
}): Insertable<DB["follow_ups"]> {
  return {
    patient_id: input.patientId,
    assigned_to_user_id: input.registrantUserId,
    assigned_by_user_id: input.assignedByUserId,
    level: input.registrantRole === "CHO" ? "CHO" : "ANM",
    track: "FIELD_15_DAY",
    scheduled_date: nextHrpFollowUpDate(input.completedAt),
  };
}

/**
 * Deepest active user with the role whose facility path is an ancestor of the
 * patient's facility path. The deepest match keeps a CHC helpdesk ahead of a
 * block-level account when both cover the village.
 */
async function findActiveUserAtOrAbove(
  database: Kysely<DB>,
  facilityPath: string,
  role: UserRole
): Promise<string | null> {
  const row = await database
    .selectFrom("users")
    .innerJoin("facilities", "facilities.id", "users.facility_id")
    .select("users.id as id")
    .where("users.is_active", "=", true)
    .where("users.role", "=", role)
    .where(
      sql<boolean>`(
        ${sql.ref("facilities.path")} = ${facilityPath}
        or starts_with(${facilityPath}, ${sql.ref("facilities.path")} || '.')
      )`
    )
    .orderBy(sql`length(${sql.ref("facilities.path")}) desc`)
    .executeTakeFirst();

  return row?.id ?? null;
}

/**
 * Resolve who owns the first cycle. Referred HRPs go to the block helpdesk,
 * then the BHM, then the actor; non-referred HRPs stay with the actor.
 */
export async function resolveInitialFollowUpOwner(
  database: Kysely<DB>,
  input: {
    facilityPath: string;
    actor: { userId: string; role: UserRole };
    track: FollowUpTrack;
  }
): Promise<FollowUpOwner> {
  if (input.track === "FIELD_15_DAY") {
    return {
      userId: input.actor.userId,
      level: followUpLevelForRole(input.actor.role),
    };
  }

  const helpdeskUserId = await findActiveUserAtOrAbove(
    database,
    input.facilityPath,
    "HRP_HELPDESK_BLOCK"
  );
  if (helpdeskUserId) {
    return { userId: helpdeskUserId, level: "BLOCK_NODAL" };
  }

  const bhmUserId = await findActiveUserAtOrAbove(database, input.facilityPath, "BHM");
  if (bhmUserId) {
    return { userId: bhmUserId, level: "BLOCK_NODAL" };
  }

  return { userId: input.actor.userId, level: "BLOCK_NODAL" };
}
