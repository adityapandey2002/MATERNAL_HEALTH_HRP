import { FacilityLevel, UserRole } from "@hrp/shared";
import type { Kysely } from "kysely";
import type { DB } from "../db/types.js";

export const REFERRAL_NODAL = "REFERRAL_NODAL" as const;

export type ResponsibilityType = typeof REFERRAL_NODAL;

export interface ResponsibilityGrant {
  responsibility: ResponsibilityType;
  scopeFacilityId: string;
  scopePath: string;
}

export interface ActorScope {
  userId: string;
  role: UserRole;
  facilityId: string;
  facilityPath: string;
  facilityLevel: FacilityLevel;
  responsibilities: readonly ResponsibilityGrant[];
}

export interface ActorUserRecord {
  id: string;
  role: string;
  facilityId: string;
  isActive: boolean;
}

export interface ActorFacilityRecord {
  id: string;
  path: string;
  level: string;
}

export interface ActorResponsibilityRecord {
  responsibility: string;
  scopeFacilityId: string;
  scopePath: string;
}

export interface ActorLookup {
  findUser(userId: string): Promise<ActorUserRecord | null>;
  findFacility(facilityId: string): Promise<ActorFacilityRecord | null>;
  findResponsibilities(userId: string): Promise<ActorResponsibilityRecord[]>;
}

export type AuthzErrorCode =
  | "UNKNOWN_USER"
  | "INACTIVE_USER"
  | "UNKNOWN_ROLE"
  | "UNKNOWN_FACILITY"
  | "ROLE_FACILITY_MISMATCH"
  | "SCOPE_WIDENING"
  | "FORBIDDEN";

export class AuthzError extends Error {
  readonly code: AuthzErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AuthzErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AuthzError";
    this.code = code;
    this.details = details;
  }
}

const ROLE_FACILITY_LEVELS: Record<UserRole, readonly FacilityLevel[]> = {
  ANM: ["VILLAGE", "HSC"],
  CHO: ["HWC"],
  BHM: ["BLOCK", "CHC"],
  DHS: ["DISTRICT"],
};

export function isFacilityRoleCompatible(role: UserRole, level: FacilityLevel): boolean {
  return ROLE_FACILITY_LEVELS[role]?.includes(level) ?? false;
}

export function isPathInSubtree(scopePath: string, targetPath: string): boolean {
  if (scopePath.length === 0 || targetPath.length === 0) return false;
  return targetPath === scopePath || targetPath.startsWith(`${scopePath}.`);
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function pathSubtreeLikePattern(path: string): string {
  return `${escapeLikePattern(path)}.%`;
}

function buildResponsibilities(
  records: readonly ActorResponsibilityRecord[]
): ResponsibilityGrant[] {
  const grants: ResponsibilityGrant[] = [];

  for (const record of records) {
    if (record.responsibility !== REFERRAL_NODAL) continue;
    if (record.scopePath.length === 0) continue;

    grants.push({
      responsibility: REFERRAL_NODAL,
      scopeFacilityId: record.scopeFacilityId,
      scopePath: record.scopePath,
    });
  }

  return grants;
}

export function buildActorScope(
  user: ActorUserRecord,
  facility: ActorFacilityRecord,
  responsibilities: readonly ActorResponsibilityRecord[] = []
): ActorScope {
  if (!user.isActive) {
    throw new AuthzError("INACTIVE_USER", "User is inactive", { userId: user.id });
  }

  const role = UserRole.safeParse(user.role);
  if (!role.success) {
    throw new AuthzError("UNKNOWN_ROLE", "User role is not supported", {
      userId: user.id,
      role: user.role,
    });
  }

  if (facility.path.length === 0) {
    throw new AuthzError("UNKNOWN_FACILITY", "Facility has no scope path", {
      facilityId: facility.id,
    });
  }

  const level = FacilityLevel.safeParse(facility.level);
  if (!level.success) {
    throw new AuthzError("UNKNOWN_FACILITY", "Facility level is not supported", {
      facilityId: facility.id,
      level: facility.level,
    });
  }

  if (!isFacilityRoleCompatible(role.data, level.data)) {
    throw new AuthzError("ROLE_FACILITY_MISMATCH", "Role is not valid for the facility level", {
      role: role.data,
      level: level.data,
      facilityId: facility.id,
    });
  }

  return {
    userId: user.id,
    role: role.data,
    facilityId: facility.id,
    facilityPath: facility.path,
    facilityLevel: level.data,
    responsibilities: buildResponsibilities(responsibilities),
  };
}

export async function resolveActor(userId: string, lookup: ActorLookup): Promise<ActorScope> {
  const user = await lookup.findUser(userId);
  if (!user) {
    throw new AuthzError("UNKNOWN_USER", "User was not found", { userId });
  }

  if (!user.isActive) {
    throw new AuthzError("INACTIVE_USER", "User is inactive", { userId });
  }

  const facility = await lookup.findFacility(user.facilityId);
  if (!facility) {
    throw new AuthzError("UNKNOWN_FACILITY", "Actor facility was not found", {
      userId,
      facilityId: user.facilityId,
    });
  }

  const responsibilities = await lookup.findResponsibilities(userId);
  return buildActorScope(user, facility, responsibilities);
}

export async function assertRequestedScope(
  actor: ActorScope,
  requestedFacilityId: string | null | undefined,
  lookup: Pick<ActorLookup, "findFacility">
): Promise<ActorScope> {
  if (!requestedFacilityId || requestedFacilityId === actor.facilityId) {
    return actor;
  }

  const facility = await lookup.findFacility(requestedFacilityId);
  if (!facility) {
    throw new AuthzError("UNKNOWN_FACILITY", "Requested facility was not found", {
      facilityId: requestedFacilityId,
    });
  }

  if (!isPathInSubtree(actor.facilityPath, facility.path)) {
    throw new AuthzError("SCOPE_WIDENING", "Requested facility is outside the actor scope", {
      actorFacilityId: actor.facilityId,
      requestedFacilityId,
    });
  }

  const level = FacilityLevel.safeParse(facility.level);
  if (!level.success) {
    throw new AuthzError("UNKNOWN_FACILITY", "Requested facility level is not supported", {
      facilityId: requestedFacilityId,
      level: facility.level,
    });
  }

  return {
    ...actor,
    facilityId: facility.id,
    facilityPath: facility.path,
    facilityLevel: level.data,
  };
}

export function createDbActorLookup(database: Kysely<DB>): ActorLookup {
  return {
    async findUser(userId) {
      const row = await database
        .selectFrom("users")
        .select(["id", "role", "facility_id", "is_active"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!row) return null;

      return {
        id: row.id,
        role: row.role,
        facilityId: row.facility_id,
        isActive: row.is_active,
      };
    },

    async findFacility(facilityId) {
      const row = await database
        .selectFrom("facilities")
        .select(["id", "path", "level"])
        .where("id", "=", facilityId)
        .executeTakeFirst();

      if (!row) return null;

      return {
        id: row.id,
        path: row.path,
        level: row.level,
      };
    },

    async findResponsibilities(userId) {
      const rows = await database
        .selectFrom("responsibilities as responsibility")
        .innerJoin("facilities as scope", "scope.id", "responsibility.scope_facility_id")
        .select([
          "responsibility.responsibility as responsibility",
          "responsibility.scope_facility_id as scope_facility_id",
          "scope.path as scope_path",
        ])
        .where("responsibility.user_id", "=", userId)
        .execute();

      return rows.map((row) => ({
        responsibility: row.responsibility,
        scopeFacilityId: row.scope_facility_id,
        scopePath: row.scope_path,
      }));
    },
  };
}
