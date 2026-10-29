import type { FacilityLevel, UserRole } from "@hrp/shared";
import { AuthzError } from "./scope.js";
import type { ActorScope } from "./scope.js";
import { REFERRAL_NODAL, isPathInSubtree } from "./scope.js";

export const ACTIONS = [
  "patient:read",
  "patient:write",
  "patient:delete",
  "patient:archive",
  "visit:read",
  "visit:write",
  "visit:delete",
  "referral:read",
  "referral:create",
  "referral:respond",
  "alert:read",
  "alert:acknowledge",
  "queue:read",
  "queue:retry",
  "sync:read",
  "sync:push",
  "facility:read",
  "dashboard:read",
  "audit:read",
  "admin:manage",
  "staff:manage",
  "followup:manage",
] as const;

export type Action = (typeof ACTIONS)[number];

export interface FacilityTarget {
  type: "facility";
  facilityPath: string | null;
}

export interface ReferralTarget {
  type: "referral";
  fromFacilityPath: string | null;
  toFacilityPath: string | null;
  toFacilityLevel?: FacilityLevel | null;
}

export type ResourceTarget = FacilityTarget | ReferralTarget;

export type DenyReason =
  | "ROLE_NOT_PERMITTED"
  | "OUT_OF_SCOPE"
  | "MISSING_TARGET_SCOPE"
  | "REFERRAL_NOT_VISIBLE"
  | "TARGET_TYPE_MISMATCH"
  | "UNKNOWN_ACTION";

export type Decision =
  | { allowed: true; reason: "ALLOWED" }
  | { allowed: false; reason: DenyReason; httpStatus: 403 | 404 };

type PolicyResult = { allowed: true; reason: "ALLOWED" } | { allowed: false; reason: DenyReason };

const READ_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "patient:read",
  "visit:read",
  "referral:read",
  "alert:read",
  "queue:read",
  "sync:read",
  "facility:read",
  "dashboard:read",
  "audit:read",
]);

const CLINICAL_WRITE_ROLES: readonly UserRole[] = ["ANM", "CHO", "HELPDESK"];
const SUPERVISION_ROLES: readonly UserRole[] = ["CHO", "BHM", "DHS"];
const STAFF_ADMIN_ROLES: readonly UserRole[] = ["BHM", "DHS"];

const REFERRAL_DESTINATION_LEVELS: Partial<Record<UserRole, readonly FacilityLevel[]>> = {
  CHO: ["HWC"],
  BHM: ["BLOCK", "CHC"],
  DHS: ["DISTRICT"],
  HELPDESK: ["BLOCK", "CHC"],
};

function allow(): PolicyResult {
  return { allowed: true, reason: "ALLOWED" };
}

function deny(reason: DenyReason): PolicyResult {
  return { allowed: false, reason };
}

function isFacilityInScope(actor: ActorScope, facilityPath: string | null | undefined): boolean {
  return typeof facilityPath === "string" && isPathInSubtree(actor.facilityPath, facilityPath);
}

function hasNodalGrant(actor: ActorScope, facilityPath: string | null | undefined): boolean {
  if (typeof facilityPath !== "string" || facilityPath.length === 0) return false;

  return actor.responsibilities.some(
    (grant) =>
      grant.responsibility === REFERRAL_NODAL && isPathInSubtree(grant.scopePath, facilityPath)
  );
}

function canReadFacilityScoped(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (target.type !== "facility") {
    return deny("TARGET_TYPE_MISMATCH");
  }

  const facilityPath = target.facilityPath;
  if (typeof facilityPath !== "string" || facilityPath.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, facilityPath) ? allow() : deny("OUT_OF_SCOPE");
}

function canWriteClinical(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (!CLINICAL_WRITE_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  if (target.type !== "facility") {
    return deny("TARGET_TYPE_MISMATCH");
  }

  const facilityPath = target.facilityPath;
  if (typeof facilityPath !== "string" || facilityPath.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  if (actor.role === "ANM") {
    return facilityPath === actor.homeFacilityPath ? allow() : deny("OUT_OF_SCOPE");
  }

  return isPathInSubtree(actor.facilityPath, facilityPath) ? allow() : deny("OUT_OF_SCOPE");
}

function canReadReferral(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (target.type !== "referral") {
    return deny("TARGET_TYPE_MISMATCH");
  }

  const fromFacilityPath = target.fromFacilityPath ?? null;
  const toFacilityPath = target.toFacilityPath ?? null;

  if (fromFacilityPath === null && toFacilityPath === null) {
    return deny("MISSING_TARGET_SCOPE");
  }

  if (hasNodalGrant(actor, fromFacilityPath) || hasNodalGrant(actor, toFacilityPath)) {
    return allow();
  }

  if (actor.role === "ANM") {
    return fromFacilityPath === actor.facilityPath ? allow() : deny("REFERRAL_NOT_VISIBLE");
  }

  if (isFacilityInScope(actor, fromFacilityPath) || isFacilityInScope(actor, toFacilityPath)) {
    return allow();
  }

  return deny("REFERRAL_NOT_VISIBLE");
}

function canRespondToReferral(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (target.type !== "referral") {
    return deny("TARGET_TYPE_MISMATCH");
  }

  const destination = target.toFacilityPath;
  if (typeof destination !== "string" || destination.length === 0) {
    return deny("MISSING_TARGET_SCOPE");
  }

  const destinationLevel = target.toFacilityLevel;
  if (!destinationLevel) {
    return deny("MISSING_TARGET_SCOPE");
  }

  if (hasNodalGrant(actor, destination)) {
    return allow();
  }

  const allowedLevels = REFERRAL_DESTINATION_LEVELS[actor.role];
  if (!allowedLevels) {
    return deny("ROLE_NOT_PERMITTED");
  }

  if (!isFacilityInScope(actor, destination)) {
    return deny("OUT_OF_SCOPE");
  }

  return allowedLevels.includes(destinationLevel) ? allow() : deny("ROLE_NOT_PERMITTED");
}

function canAcknowledgeAlert(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (!SUPERVISION_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  return canReadFacilityScoped(actor, target);
}

function canRetryQueue(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (!SUPERVISION_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  return canReadFacilityScoped(actor, target);
}

function canAdminister(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (actor.role !== "DHS") {
    return deny("ROLE_NOT_PERMITTED");
  }

  return canReadFacilityScoped(actor, target);
}

/**
 * Follow-up status updates and dispatch are shared across tiers: the ANM or
 * CHO closes a field contact, the helpdesk works the block line list, and the
 * nodal officer can correct a row from the block panel.
 */
function canManageFollowUp(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (actor.role === "BHM" || actor.role === "DHS") {
    return canReadFacilityScoped(actor, target);
  }

  return canWriteClinical(actor, target);
}

/** Block Nodal and District officers provision helpdesk staff in their scope. */
function canManageStaff(actor: ActorScope, target: ResourceTarget): PolicyResult {
  if (!STAFF_ADMIN_ROLES.includes(actor.role)) {
    return deny("ROLE_NOT_PERMITTED");
  }

  return canReadFacilityScoped(actor, target);
}

function evaluate(actor: ActorScope, action: Action, target: ResourceTarget): PolicyResult {
  switch (action) {
    case "patient:read":
    case "visit:read":
    case "alert:read":
    case "queue:read":
    case "sync:read":
    case "facility:read":
    case "dashboard:read":
      return canReadFacilityScoped(actor, target);

    case "patient:write":
    case "visit:write":
    case "referral:create":
    case "sync:push":
      return canWriteClinical(actor, target);

    case "patient:archive":
    case "audit:read":
    case "admin:manage":
      return canAdminister(actor, target);

    case "patient:delete":
    case "visit:delete":
      return deny("ROLE_NOT_PERMITTED");

    case "referral:read":
      return canReadReferral(actor, target);

    case "referral:respond":
      return canRespondToReferral(actor, target);

    case "alert:acknowledge":
      return canAcknowledgeAlert(actor, target);

    case "queue:retry":
      return canRetryQueue(actor, target);

    case "followup:manage":
      return canManageFollowUp(actor, target);

    case "staff:manage":
      return canManageStaff(actor, target);

    default:
      return deny("UNKNOWN_ACTION");
  }
}

export function can(actor: ActorScope, action: Action, target: ResourceTarget): Decision {
  const result = evaluate(actor, action, target);

  if (result.allowed) {
    return result;
  }

  const outOfScopeRead =
    (result.reason === "OUT_OF_SCOPE" || result.reason === "REFERRAL_NOT_VISIBLE") &&
    READ_ACTIONS.has(action);

  return {
    allowed: false,
    reason: result.reason,
    httpStatus: outOfScopeRead ? 404 : 403,
  };
}

export function assertCan(actor: ActorScope, action: Action, target: ResourceTarget): void {
  const decision = can(actor, action, target);

  if (!decision.allowed) {
    throw new AuthzError(
      "FORBIDDEN",
      "Action is not permitted",
      {
        action,
        reason: decision.reason,
      },
      decision.httpStatus
    );
  }
}
