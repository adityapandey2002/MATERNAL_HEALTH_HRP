import type { FacilityLevel, UserRole } from "@hrp/shared";
import { describe, expect, it } from "vitest";
import { assertCan, can } from "./policy.js";
import type { Action } from "./policy.js";
import { AuthzError } from "./scope.js";
import type { ActorScope, ResponsibilityGrant } from "./scope.js";

const DISTRICT_PATH = "INDIA.BIHAR.ARARIA";
const OTHER_DISTRICT_PATH = "INDIA.BIHAR.KISHANGANJ";
const BLOCK_PATH = `${DISTRICT_PATH}.RANIGANJ`;
const OTHER_BLOCK_PATH = `${DISTRICT_PATH}.FORBESGANJ`;
const HWC_PATH = `${BLOCK_PATH}.PHC_KUHA.HWC_PASUNJ`;
const VILLAGE_PATH = `${HWC_PATH}.VIL_PAS`;
const SIBLING_VILLAGE_PATH = `${HWC_PATH}.VIL_BALUA`;
const CHC_PATH = `${BLOCK_PATH}.CHC_RANIGANJ`;

const READ_ACTIONS: readonly Action[] = [
  "patient:read",
  "visit:read",
  "alert:read",
  "queue:read",
  "sync:read",
  "facility:read",
  "dashboard:read",
];

const CLINICAL_WRITE_ACTIONS: readonly Action[] = [
  "patient:write",
  "visit:write",
  "referral:create",
  "sync:push",
];

const ALL_ACTIONS: readonly Action[] = [
  ...READ_ACTIONS,
  ...CLINICAL_WRITE_ACTIONS,
  "referral:read",
  "referral:respond",
  "alert:acknowledge",
  "audit:read",
  "admin:manage",
];

const ACTOR_FACILITIES: Record<UserRole, { path: string; level: FacilityLevel }> = {
  ANM: { path: VILLAGE_PATH, level: "VILLAGE" },
  CHO: { path: HWC_PATH, level: "HWC" },
  BHM: { path: BLOCK_PATH, level: "BLOCK" },
  DHS: { path: DISTRICT_PATH, level: "DISTRICT" },
};

const BASE_READS: readonly Action[] = [...READ_ACTIONS, "referral:read"];

const EXPECTED_ALLOWED: Record<UserRole, ReadonlySet<Action>> = {
  ANM: new Set([...BASE_READS, ...CLINICAL_WRITE_ACTIONS, "alert:acknowledge"]),
  CHO: new Set([...BASE_READS, ...CLINICAL_WRITE_ACTIONS, "referral:respond", "alert:acknowledge"]),
  BHM: new Set([...BASE_READS, "referral:respond", "alert:acknowledge"]),
  DHS: new Set([
    ...BASE_READS,
    "referral:respond",
    "alert:acknowledge",
    "audit:read",
    "admin:manage",
  ]),
};

function makeActor(
  role: UserRole,
  responsibilities: readonly ResponsibilityGrant[] = []
): ActorScope {
  const facility = ACTOR_FACILITIES[role];

  return {
    userId: `user-${role}`,
    role,
    facilityId: `facility-${role}`,
    facilityPath: facility.path,
    facilityLevel: facility.level,
    responsibilities,
  };
}

function targetFor(actor: ActorScope) {
  return {
    facilityPath: actor.facilityPath,
    fromFacilityPath: actor.facilityPath,
    toFacilityPath: actor.facilityPath,
  };
}

describe("action matrix", () => {
  it("applies the expected decision to every role and action within its own scope", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);
      const expected = EXPECTED_ALLOWED[role];

      for (const action of ALL_ACTIONS) {
        const decision = can(actor, action, targetFor(actor));
        expect(decision.allowed, `${role} ${action}`).toBe(expected.has(action));
      }
    }
  });

  it("denies every read outside the actor subtree", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      for (const action of [...READ_ACTIONS, "alert:acknowledge"] as Action[]) {
        const decision = can(actor, action, { facilityPath: OTHER_DISTRICT_PATH });
        expect(decision).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" });
      }
    }
  });

  it("denies reads without a target facility", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      for (const action of READ_ACTIONS) {
        expect(can(actor, action, {})).toEqual({
          allowed: false,
          reason: "MISSING_TARGET_SCOPE",
        });
      }
    }
  });
});

describe("clinical writes", () => {
  it("allows ANM only at the exact own facility", () => {
    const anm = makeActor("ANM");

    expect(can(anm, "patient:write", { facilityPath: VILLAGE_PATH })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(anm, "visit:write", { facilityPath: SIBLING_VILLAGE_PATH })).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
    });
    expect(can(anm, "referral:create", { facilityPath: HWC_PATH })).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
    });
    expect(can(anm, "sync:push", { facilityPath: HWC_PATH })).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
    });
  });

  it("allows CHO anywhere in the HWC subtree", () => {
    const cho = makeActor("CHO");

    for (const action of CLINICAL_WRITE_ACTIONS) {
      expect(can(cho, action, { facilityPath: VILLAGE_PATH })).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(cho, action, { facilityPath: HWC_PATH })).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(cho, action, { facilityPath: OTHER_DISTRICT_PATH })).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
      });
    }
  });

  it("denies BHM and DHS clinical writes", () => {
    for (const role of ["BHM", "DHS"] as UserRole[]) {
      const actor = makeActor(role);

      for (const action of CLINICAL_WRITE_ACTIONS) {
        expect(can(actor, action, { facilityPath: actor.facilityPath })).toEqual({
          allowed: false,
          reason: "ROLE_NOT_PERMITTED",
        });
      }
    }
  });

  it("rejects a clinical write without a target facility", () => {
    for (const role of ["ANM", "CHO"] as UserRole[]) {
      for (const action of CLINICAL_WRITE_ACTIONS) {
        expect(can(makeActor(role), action, {})).toEqual({
          allowed: false,
          reason: "MISSING_TARGET_SCOPE",
        });
      }
    }
  });
});

describe("referral visibility", () => {
  it("allows all roles when the origin or destination is in scope", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      expect(can(actor, "referral:read", { fromFacilityPath: actor.facilityPath })).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(actor, "referral:read", { toFacilityPath: actor.facilityPath })).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
    }
  });

  it("denies referrals outside both the actor subtree and any nodal grant", () => {
    const actor = makeActor("CHO");

    expect(
      can(actor, "referral:read", {
        fromFacilityPath: OTHER_DISTRICT_PATH,
        toFacilityPath: `${OTHER_DISTRICT_PATH}.DIST_HOSPITAL`,
      })
    ).toEqual({ allowed: false, reason: "REFERRAL_NOT_VISIBLE" });
  });

  it("rejects a referral target without endpoints", () => {
    expect(can(makeActor("DHS"), "referral:read", {})).toEqual({
      allowed: false,
      reason: "MISSING_TARGET_SCOPE",
    });
  });

  it("grants block nodal visibility to a user outside the referral facility", () => {
    const anm = makeActor("ANM", [
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "facility-block",
        scopePath: BLOCK_PATH,
      },
    ]);

    expect(can(anm, "referral:read", { fromFacilityPath: CHC_PATH })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(anm, "referral:read", { toFacilityPath: SIBLING_VILLAGE_PATH })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
  });

  it("does not let a nodal grant cover another block", () => {
    const anm = makeActor("ANM", [
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "facility-block",
        scopePath: BLOCK_PATH,
      },
    ]);

    expect(
      can(anm, "referral:read", { fromFacilityPath: `${OTHER_BLOCK_PATH}.CHC_FORBESGANJ` })
    ).toEqual({ allowed: false, reason: "REFERRAL_NOT_VISIBLE" });
  });
});

describe("referral responses", () => {
  it("allows CHO, BHM and DHS at an in-scope destination", () => {
    expect(can(makeActor("CHO"), "referral:respond", { toFacilityPath: HWC_PATH })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(makeActor("BHM"), "referral:respond", { toFacilityPath: CHC_PATH })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(
      can(makeActor("DHS"), "referral:respond", {
        toFacilityPath: `${DISTRICT_PATH}.DIST_HOSPITAL`,
      })
    ).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it("denies ANM and destinations outside scope", () => {
    expect(can(makeActor("ANM"), "referral:respond", { toFacilityPath: VILLAGE_PATH })).toEqual({
      allowed: false,
      reason: "ROLE_NOT_PERMITTED",
    });
    expect(
      can(makeActor("CHO"), "referral:respond", { toFacilityPath: OTHER_DISTRICT_PATH })
    ).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" });
    expect(can(makeActor("BHM"), "referral:respond", { toFacilityPath: OTHER_BLOCK_PATH })).toEqual(
      { allowed: false, reason: "OUT_OF_SCOPE" }
    );
  });

  it("rejects a missing destination", () => {
    expect(can(makeActor("DHS"), "referral:respond", {})).toEqual({
      allowed: false,
      reason: "MISSING_TARGET_SCOPE",
    });
  });
});

describe("administration and audit", () => {
  it("allows DHS only inside the district subtree", () => {
    const dhs = makeActor("DHS");

    for (const action of ["audit:read", "admin:manage"] as Action[]) {
      expect(can(dhs, action, { facilityPath: BLOCK_PATH })).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(dhs, action, { facilityPath: OTHER_DISTRICT_PATH })).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
      });
      expect(can(dhs, action, {})).toEqual({
        allowed: false,
        reason: "MISSING_TARGET_SCOPE",
      });
    }
  });

  it("denies audit and admin actions to ANM, CHO and BHM", () => {
    for (const role of ["ANM", "CHO", "BHM"] as UserRole[]) {
      const actor = makeActor(role);

      for (const action of ["audit:read", "admin:manage"] as Action[]) {
        expect(can(actor, action, { facilityPath: actor.facilityPath })).toEqual({
          allowed: false,
          reason: "ROLE_NOT_PERMITTED",
        });
      }
    }
  });
});

describe("deny-by-default enforcement", () => {
  it("rejects an action outside the Action union", () => {
    expect(can(makeActor("DHS"), "unknown:action" as Action, {})).toEqual({
      allowed: false,
      reason: "UNKNOWN_ACTION",
    });
  });

  it("throws AuthzError when assertCan denies the action", () => {
    expect(() =>
      assertCan(makeActor("DHS"), "patient:read", { facilityPath: DISTRICT_PATH })
    ).not.toThrow();

    try {
      assertCan(makeActor("ANM"), "audit:read", { facilityPath: VILLAGE_PATH });
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthzError);
      expect((error as AuthzError).code).toBe("FORBIDDEN");
      expect((error as AuthzError).details).toEqual({
        action: "audit:read",
        reason: "ROLE_NOT_PERMITTED",
      });
    }
  });
});
