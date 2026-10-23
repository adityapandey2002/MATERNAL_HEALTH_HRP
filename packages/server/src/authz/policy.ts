import type { UserRole } from "@hrp/shared";
import { AuthzError } from "./scope.js";
import type { ActorScope } from "./scope.js";
import { REFERRAL_NODAL, isPathInSubtree } from "./scope.js";

export type Action =
  | "patient:read"
  | "patient:write"
  | "visit:read"
  | "visit:write"
  | "referral:read"
  | "referral:create"
  | "referral:respond"
  | "alert:read"
  | "alert:acknowledge"
  | "queue:read"
  | "sync:read"
  | "sync:push"
  | "facility:read"
  | "dashboard:read"
  | "audit:read"
  | "admin:manage";

export interface ResourceTarget {
  facilityPath?: string | null;
  fromFacilityPath?: string | null;
  toFacilityPath?: string | null;
}

export type DenyReason =
  | "ROLE_NOT_PERMITTED"
  | "OUT_OF_SCOPE"
  | "MISSING_TARGET_SCOPE"
  | "REFERRAL_NOT_VISIBLE"
  | "UNKNOWN_ACTION";

export type Decision =
  | { allowed: true; reason: "ALLOWED" }
  | { allowed: false; reason: DenyReason };

const CLINICAL_WRITE_ROLES: readonly UserRole[] = ["ANM", "CHO"];
const REFERRAL_RESPOND_ROLES: readonly UserRole[] = ["CHO", "BHM", "DHS"];

function allow(): Decision {
  return { allowed: true, reason: "ALLOWED" };
}

function deny(reason: DenyReason): Decision {
  return { allowed: false, reason };
}

function isFacilityInScope(actor: ActorScope, facilityPath: string | null | undefined): boolean {
  return typeof facilityPath === "string" && isPathInSubtree(actor.facilityPath, facilityPath);
}

function hasNodalGrant(actor: ActorScope, facilityPath: string | null): boolean {
  if (facilityPath === null) return false;

  return actor.responsibilities.some(
    (grant) =>
      grant.responsibility === REFERRAL_NODAL && isPathInSubtree(grant.scopePath, facilityPath)
  );
}

function canReadFacilityScoped(actor: ActorScope, target: ResourceTarget): Decision {
  const facilityPath = target.facilityPath;
  if (typeof facilityPath !== "string" || facilityPath.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, facilityPath) ? allow() : deny("OUT_OF_SCOPE");
}

function canWriteClinical(actor: ActorScope, target: ResourceTarget): Decision {
  if (!CLINICAL_WRITE_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  const facilityPath = target.facilityPath;
  if (typeof facilityPath !== "string" || facilityPath.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  if (actor.role === "ANM") {
    return facilityPath === actor.facilityPath ? allow() : deny("OUT_OF_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, facilityPath) ? allow() : deny("OUT_OF_SCOPE");
}

function canReadReferral(actor: ActorScope, target: ResourceTarget): Decision {
  const fromFacilityPath = target.fromFacilityPath ?? null;
  const toFacilityPath = target.toFacilityPath ?? null;

  if (fromFacilityPath === null && toFacilityPath === null) {
    return deny("MISSING_TARGET_SCOPE");
  }

  if (isFacilityInScope(actor, fromFacilityPath) || isFacilityInScope(actor, toFacilityPath)) {
    return allow();
  }

  if (hasNodalGrant(actor, fromFacilityPath) || hasNodalGrant(actor, toFacilityPath)) {
    return allow();
  }

  return deny("REFERRAL_NOT_VISIBLE");
}

function canRespondToReferral(actor: ActorScope, target: ResourceTarget): Decision {
  if (!REFERRAL_RESPOND_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  const destination = target.toFacilityPath;
  if (typeof destination !== "string" || destination.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, destination) ? allow() : deny("OUT_OF_SCOPE");
}

function canAdminister(actor: ActorScope, target: ResourceTarget): Decision {
  if (actor.role !== "DHS") {
    return deny("ROLE_NOT_PERMITTED");
  }

  const facilityPath = target.facilityPath;
  if (typeof facilityPath !== "string" || facilityPath.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, facilityPath) ? allow() : deny("OUT_OF_SCOPE");
}

export function can(actor: ActorScope, action: Action, target: ResourceTarget): Decision {
  switch (action) {
    case "patient:read":
    case "visit:read":
    case "alert:read":
    case "queue:read":
    case "sync:read":
    case "facility:read":
    case "dashboard:read":
    case "alert:acknowledge":
      return canReadFacilityScoped(actor, target);

    case "patient:write":
    case "visit:write":
    case "referral:create":
    case "sync:push":
      return canWriteClinical(actor, target);

    case "referral:read":
      return canReadReferral(actor, target);

    case "referral:respond":
      return canRespondToReferral(actor, target);

    case "audit:read":
    case "admin:manage":
      return canAdminister(actor, target);

    default:
      return deny("UNKNOWN_ACTION");
  }
}

export function assertCan(actor: ActorScope, action: Action, target: ResourceTarget): void {
  const decision = can(actor, action, target);

  if (!decision.allowed) {
    throw new AuthzError("FORBIDDEN", "Action is not permitted", {
      action,
      reason: decision.reason,
    });
  }
}
