import type { FacilityLevel, UserRole } from "@hrp/shared";
import { describe, expect, it } from "vitest";
import { ACTIONS, assertCan, can } from "./policy.js";
import type { Action, ResourceTarget } from "./policy.js";
import { AuthzError, assertRequestedScope } from "./scope.js";
import type { ActorScope, ResponsibilityGrant } from "./scope.js";

const DISTRICT_PATH = "INDIA.BIHAR.ARARIA";
const OTHER_DISTRICT_PATH = "INDIA.BIHAR.KISHANGANJ";
const BLOCK_PATH = `${DISTRICT_PATH}.RANIGANJ`;
const OTHER_BLOCK_PATH = `${DISTRICT_PATH}.FORBESGANJ`;
const HWC_PATH = `${BLOCK_PATH}.PHC_KUHA.HWC_PASUNJ`;
const VILLAGE_PATH = `${HWC_PATH}.VIL_PAS`;
const SIBLING_VILLAGE_PATH = `${HWC_PATH}.VIL_BALUA`;
const CHC_PATH = `${BLOCK_PATH}.CHC_RANIGANJ`;
const DISTRICT_HOSPITAL_PATH = `${DISTRICT_PATH}.DIST_HOSPITAL`;
const HSC_PATH = `${BLOCK_PATH}.PHC_KUHA.HSC_PAS`;
const HSC_VILLAGE_PATH = `${HSC_PATH}.VIL_PAS`;

const FACILITY_READ_ACTIONS: readonly Action[] = [
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

const SUPERVISION_ACTIONS: readonly Action[] = [
  "referral:respond",
  "alert:acknowledge",
  "queue:retry",
];

const BASE_READS: readonly Action[] = [...FACILITY_READ_ACTIONS, "referral:read"];

const DENIED_ACTIONS: ReadonlySet<Action> = new Set<Action>(["patient:delete", "visit:delete"]);

const ACTOR_FACILITIES: Record<UserRole, { path: string; level: FacilityLevel }> = {
  ANM: { path: VILLAGE_PATH, level: "VILLAGE" },
  CHO: { path: HWC_PATH, level: "HWC" },
  BHM: { path: BLOCK_PATH, level: "BLOCK" },
  DHS: { path: DISTRICT_PATH, level: "DISTRICT" },
  HELPDESK: { path: BLOCK_PATH, level: "BLOCK" },
};

const EXPECTED_ALLOWED: Record<UserRole, ReadonlySet<Action>> = {
  ANM: new Set([...BASE_READS, ...CLINICAL_WRITE_ACTIONS, "followup:manage"]),
  CHO: new Set([
    ...BASE_READS,
    ...CLINICAL_WRITE_ACTIONS,
    ...SUPERVISION_ACTIONS,
    "followup:manage",
  ]),
  BHM: new Set([...BASE_READS, ...SUPERVISION_ACTIONS, "staff:manage", "followup:manage"]),
  DHS: new Set([
    ...BASE_READS,
    ...SUPERVISION_ACTIONS,
    "patient:archive",
    "audit:read",
    "admin:manage",
    "staff:manage",
    "followup:manage",
  ]),
  HELPDESK: new Set([
    ...BASE_READS,
    ...CLINICAL_WRITE_ACTIONS,
    "referral:respond",
    "followup:manage",
  ]),
};

function makeActor(
  role: UserRole,
  responsibilities: readonly ResponsibilityGrant[] = [],
  facility: { path: string; level: FacilityLevel } = ACTOR_FACILITIES[role]
): ActorScope {
  const facilityId = `facility-${role}`;

  return {
    userId: `user-${role}`,
    role,
    facilityId,
    facilityPath: facility.path,
    facilityLevel: facility.level,
    homeFacilityId: facilityId,
    homeFacilityPath: facility.path,
    homeFacilityLevel: facility.level,
    responsibilities,
  };
}

function facilityTarget(facilityPath: string | null): ResourceTarget {
  return { type: "facility", facilityPath };
}

function referralTarget(
  fromFacilityPath: string | null,
  toFacilityPath: string | null,
  toFacilityLevel: FacilityLevel | null = null
): ResourceTarget {
  return { type: "referral", fromFacilityPath, toFacilityPath, toFacilityLevel };
}

function targetFor(action: Action, actor: ActorScope): ResourceTarget {
  if (action === "referral:read") {
    return referralTarget(actor.facilityPath, null);
  }
  if (action === "referral:respond") {
    return referralTarget(null, actor.facilityPath, actor.facilityLevel);
  }
  return facilityTarget(actor.facilityPath);
}

describe("action matrix", () => {
  it("declares every action once", () => {
    expect(new Set(ACTIONS).size).toBe(ACTIONS.length);
  });

  it("applies the expected decision to every role and action within its own scope", () => {
    const accounted = new Set<Action>([
      ...Object.values(EXPECTED_ALLOWED).flatMap((allowed) => [...allowed]),
      ...DENIED_ACTIONS,
    ]);

    expect([...ACTIONS].every((action) => accounted.has(action))).toBe(true);

    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);
      const expectedAllowed = EXPECTED_ALLOWED[role];

      for (const action of ACTIONS) {
        const expected = !DENIED_ACTIONS.has(action) && expectedAllowed.has(action);
        const decision = can(actor, action, targetFor(action, actor));
        expect(decision.allowed, `${role} ${action}`).toBe(expected);
      }
    }
  });

  it("denies every facility read outside the actor subtree with 404", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      for (const action of FACILITY_READ_ACTIONS) {
        const decision = can(actor, action, facilityTarget(OTHER_DISTRICT_PATH));
        expect(decision).toEqual({
          allowed: false,
          reason: "OUT_OF_SCOPE",
          httpStatus: 404,
        });
      }
    }
  });

  it("denies reads without a target facility", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      for (const action of FACILITY_READ_ACTIONS) {
        expect(can(actor, action, facilityTarget(null))).toEqual({
          allowed: false,
          reason: "MISSING_TARGET_SCOPE",
          httpStatus: 403,
        });
      }
    }
  });

  it("rejects a referral target for a facility-scoped action", () => {
    expect(can(makeActor("DHS"), "patient:read", referralTarget(VILLAGE_PATH, HWC_PATH))).toEqual({
      allowed: false,
      reason: "TARGET_TYPE_MISMATCH",
      httpStatus: 403,
    });
  });
});

describe("clinical writes", () => {
  it("allows ANM only at the exact home facility", () => {
    const anm = makeActor("ANM");

    expect(can(anm, "patient:write", facilityTarget(VILLAGE_PATH))).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(anm, "visit:write", facilityTarget(SIBLING_VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
      httpStatus: 403,
    });
    expect(can(anm, "referral:create", facilityTarget(HWC_PATH))).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
      httpStatus: 403,
    });
    expect(can(anm, "sync:push", facilityTarget(HWC_PATH))).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
      httpStatus: 403,
    });
  });

  it("keeps ANM writes at the home facility after scope narrowing", async () => {
    const anm = makeActor("ANM", [], { path: HSC_PATH, level: "HSC" });
    const narrowed = await assertRequestedScope(anm, "facility-village", {
      findFacility: async () => ({
        id: "facility-village",
        path: HSC_VILLAGE_PATH,
        level: "VILLAGE",
      }),
    });

    expect(narrowed.facilityPath).toBe(HSC_VILLAGE_PATH);
    expect(can(narrowed, "patient:write", facilityTarget(HSC_PATH))).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(narrowed, "patient:write", facilityTarget(HSC_VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "OUT_OF_SCOPE",
      httpStatus: 403,
    });
  });

  it("allows CHO anywhere in the HWC subtree", () => {
    const cho = makeActor("CHO");

    for (const action of CLINICAL_WRITE_ACTIONS) {
      expect(can(cho, action, facilityTarget(VILLAGE_PATH))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(cho, action, facilityTarget(HWC_PATH))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(cho, action, facilityTarget(OTHER_DISTRICT_PATH))).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
        httpStatus: 403,
      });
    }
  });

  it("denies BHM and DHS clinical writes", () => {
    for (const role of ["BHM", "DHS"] as UserRole[]) {
      const actor = makeActor(role);

      for (const action of CLINICAL_WRITE_ACTIONS) {
        expect(can(actor, action, facilityTarget(actor.facilityPath))).toEqual({
          allowed: false,
          reason: "ROLE_NOT_PERMITTED",
          httpStatus: 403,
        });
      }
    }
  });

  it("rejects a clinical write without a target facility", () => {
    for (const role of ["ANM", "CHO"] as UserRole[]) {
      for (const action of CLINICAL_WRITE_ACTIONS) {
        expect(can(makeActor(role), action, facilityTarget(null))).toEqual({
          allowed: false,
          reason: "MISSING_TARGET_SCOPE",
          httpStatus: 403,
        });
      }
    }
  });

  it("rejects a referral target for a clinical write", () => {
    expect(can(makeActor("CHO"), "patient:write", referralTarget(VILLAGE_PATH, HWC_PATH))).toEqual({
      allowed: false,
      reason: "TARGET_TYPE_MISMATCH",
      httpStatus: 403,
    });
  });
});

describe("referral visibility", () => {
  it("allows every role to read its own outbound referral", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      expect(can(actor, "referral:read", referralTarget(actor.facilityPath, null))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
    }
  });

  it("allows CHO, BHM and DHS to read inbound referrals within scope", () => {
    for (const role of ["CHO", "BHM", "DHS"] as UserRole[]) {
      const actor = makeActor(role);

      expect(
        can(actor, "referral:read", referralTarget(OTHER_DISTRICT_PATH, actor.facilityPath))
      ).toEqual({ allowed: true, reason: "ALLOWED" });
    }
  });

  it("denies ANM inbound referrals even when the destination is their facility", () => {
    const anm = makeActor("ANM");

    expect(can(anm, "referral:read", referralTarget(OTHER_DISTRICT_PATH, VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "REFERRAL_NOT_VISIBLE",
      httpStatus: 404,
    });
    expect(can(anm, "referral:read", referralTarget(HWC_PATH, VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "REFERRAL_NOT_VISIBLE",
      httpStatus: 404,
    });
  });

  it("denies referrals outside both the actor subtree and any nodal grant", () => {
    const actor = makeActor("CHO");

    expect(
      can(
        actor,
        "referral:read",
        referralTarget(OTHER_DISTRICT_PATH, `${OTHER_DISTRICT_PATH}.DIST_HOSPITAL`)
      )
    ).toEqual({ allowed: false, reason: "REFERRAL_NOT_VISIBLE", httpStatus: 404 });
  });

  it("rejects a referral target without endpoints", () => {
    expect(can(makeActor("DHS"), "referral:read", referralTarget(null, null))).toEqual({
      allowed: false,
      reason: "MISSING_TARGET_SCOPE",
      httpStatus: 403,
    });
  });

  it("grants nodal visibility to either endpoint", () => {
    const anm = makeActor("ANM", [
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "facility-block",
        scopePath: BLOCK_PATH,
      },
    ]);

    expect(can(anm, "referral:read", referralTarget(CHC_PATH, null))).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(anm, "referral:read", referralTarget(null, SIBLING_VILLAGE_PATH))).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(can(anm, "referral:read", referralTarget(OTHER_DISTRICT_PATH, CHC_PATH))).toEqual({
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
      can(anm, "referral:read", referralTarget(`${OTHER_BLOCK_PATH}.CHC_FORBESGANJ`, null))
    ).toEqual({ allowed: false, reason: "REFERRAL_NOT_VISIBLE", httpStatus: 404 });
  });

  it("rejects a facility target for referral visibility", () => {
    expect(can(makeActor("CHO"), "referral:read", facilityTarget(HWC_PATH))).toEqual({
      allowed: false,
      reason: "TARGET_TYPE_MISMATCH",
      httpStatus: 403,
    });
  });
});

describe("referral responses", () => {
  it("allows each role at its destination level", () => {
    expect(
      can(makeActor("CHO"), "referral:respond", referralTarget(null, HWC_PATH, "HWC"))
    ).toEqual({ allowed: true, reason: "ALLOWED" });
    expect(
      can(makeActor("BHM"), "referral:respond", referralTarget(null, CHC_PATH, "CHC"))
    ).toEqual({ allowed: true, reason: "ALLOWED" });
    expect(
      can(makeActor("BHM"), "referral:respond", referralTarget(null, BLOCK_PATH, "BLOCK"))
    ).toEqual({ allowed: true, reason: "ALLOWED" });
    expect(
      can(
        makeActor("DHS"),
        "referral:respond",
        referralTarget(null, DISTRICT_HOSPITAL_PATH, "DISTRICT")
      )
    ).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it("allows a REFERRAL_NODAL grant to cover the destination", () => {
    const anm = makeActor("ANM", [
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "facility-district",
        scopePath: DISTRICT_PATH,
      },
    ]);

    expect(
      can(anm, "referral:respond", referralTarget(null, DISTRICT_HOSPITAL_PATH, "DISTRICT"))
    ).toEqual({ allowed: true, reason: "ALLOWED" });
  });

  it("denies every role at a destination outside its role matrix", () => {
    expect(
      can(makeActor("CHO"), "referral:respond", referralTarget(null, VILLAGE_PATH, "VILLAGE"))
    ).toEqual({ allowed: false, reason: "ROLE_NOT_PERMITTED", httpStatus: 403 });
    expect(
      can(makeActor("BHM"), "referral:respond", referralTarget(null, HWC_PATH, "HWC"))
    ).toEqual({ allowed: false, reason: "ROLE_NOT_PERMITTED", httpStatus: 403 });
    expect(
      can(makeActor("DHS"), "referral:respond", referralTarget(null, BLOCK_PATH, "BLOCK"))
    ).toEqual({ allowed: false, reason: "ROLE_NOT_PERMITTED", httpStatus: 403 });
  });

  it("denies ANM without a nodal grant", () => {
    expect(
      can(makeActor("ANM"), "referral:respond", referralTarget(null, VILLAGE_PATH, "VILLAGE"))
    ).toEqual({ allowed: false, reason: "ROLE_NOT_PERMITTED", httpStatus: 403 });
  });

  it("denies destinations outside the actor scope", () => {
    expect(
      can(makeActor("CHO"), "referral:respond", referralTarget(null, OTHER_DISTRICT_PATH, "HWC"))
    ).toEqual({ allowed: false, reason: "OUT_OF_SCOPE", httpStatus: 403 });
    expect(
      can(makeActor("BHM"), "referral:respond", referralTarget(null, OTHER_BLOCK_PATH, "CHC"))
    ).toEqual({ allowed: false, reason: "OUT_OF_SCOPE", httpStatus: 403 });
    expect(
      can(
        makeActor("DHS"),
        "referral:respond",
        referralTarget(null, OTHER_DISTRICT_PATH, "DISTRICT")
      )
    ).toEqual({ allowed: false, reason: "OUT_OF_SCOPE", httpStatus: 403 });
  });

  it("requires a destination path and level", () => {
    expect(can(makeActor("DHS"), "referral:respond", referralTarget(null, null, null))).toEqual({
      allowed: false,
      reason: "MISSING_TARGET_SCOPE",
      httpStatus: 403,
    });
    expect(
      can(makeActor("DHS"), "referral:respond", referralTarget(null, DISTRICT_HOSPITAL_PATH, null))
    ).toEqual({ allowed: false, reason: "MISSING_TARGET_SCOPE", httpStatus: 403 });
  });

  it("rejects a facility target for referral responses", () => {
    expect(can(makeActor("CHO"), "referral:respond", facilityTarget(HWC_PATH))).toEqual({
      allowed: false,
      reason: "TARGET_TYPE_MISMATCH",
      httpStatus: 403,
    });
  });
});

describe("supervision actions", () => {
  it("denies alert acknowledgement to ANM", () => {
    expect(can(makeActor("ANM"), "alert:acknowledge", facilityTarget(VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "ROLE_NOT_PERMITTED",
      httpStatus: 403,
    });
  });

  it("allows CHO, BHM and DHS to acknowledge alerts within scope", () => {
    for (const role of ["CHO", "BHM", "DHS"] as UserRole[]) {
      const actor = makeActor(role);

      expect(can(actor, "alert:acknowledge", facilityTarget(actor.facilityPath))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(actor, "alert:acknowledge", facilityTarget(OTHER_DISTRICT_PATH))).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
        httpStatus: 403,
      });
    }
  });

  it("allows queue retry to CHO, BHM and DHS only", () => {
    for (const role of ["CHO", "BHM", "DHS"] as UserRole[]) {
      const actor = makeActor(role);

      expect(can(actor, "queue:retry", facilityTarget(actor.facilityPath))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(actor, "queue:retry", facilityTarget(OTHER_DISTRICT_PATH))).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
        httpStatus: 403,
      });
    }

    expect(can(makeActor("ANM"), "queue:retry", facilityTarget(VILLAGE_PATH))).toEqual({
      allowed: false,
      reason: "ROLE_NOT_PERMITTED",
      httpStatus: 403,
    });
  });
});

describe("administration, archive and deletion", () => {
  it("allows DHS administration inside the district subtree", () => {
    const dhs = makeActor("DHS");

    for (const action of ["audit:read", "admin:manage", "patient:archive"] as Action[]) {
      expect(can(dhs, action, facilityTarget(BLOCK_PATH))).toEqual({
        allowed: true,
        reason: "ALLOWED",
      });
      expect(can(dhs, action, facilityTarget(OTHER_DISTRICT_PATH))).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
        httpStatus: action === "audit:read" ? 404 : 403,
      });
      expect(can(dhs, action, facilityTarget(null))).toEqual({
        allowed: false,
        reason: "MISSING_TARGET_SCOPE",
        httpStatus: 403,
      });
    }
  });

  it("denies audit, admin and archive actions to ANM, CHO and BHM", () => {
    for (const role of ["ANM", "CHO", "BHM"] as UserRole[]) {
      const actor = makeActor(role);

      for (const action of ["audit:read", "admin:manage", "patient:archive"] as Action[]) {
        expect(can(actor, action, facilityTarget(actor.facilityPath))).toEqual({
          allowed: false,
          reason: "ROLE_NOT_PERMITTED",
          httpStatus: 403,
        });
      }
    }
  });

  it("denies patient and visit deletion to every role", () => {
    for (const role of Object.keys(EXPECTED_ALLOWED) as UserRole[]) {
      const actor = makeActor(role);

      for (const action of DENIED_ACTIONS) {
        expect(can(actor, action, facilityTarget(actor.facilityPath))).toEqual({
          allowed: false,
          reason: "ROLE_NOT_PERMITTED",
          httpStatus: 403,
        });
      }
    }
  });
});

describe("deny-by-default enforcement", () => {
  it("rejects an action outside the Action union", () => {
    expect(
      can(makeActor("DHS"), "unknown:action" as Action, facilityTarget(DISTRICT_PATH))
    ).toEqual({ allowed: false, reason: "UNKNOWN_ACTION", httpStatus: 403 });
  });

  it("throws AuthzError with the decision status", () => {
    expect(() =>
      assertCan(makeActor("DHS"), "patient:read", facilityTarget(DISTRICT_PATH))
    ).not.toThrow();

    try {
      assertCan(makeActor("DHS"), "patient:read", facilityTarget(OTHER_DISTRICT_PATH));
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthzError);
      expect((error as AuthzError).code).toBe("FORBIDDEN");
      expect((error as AuthzError).httpStatus).toBe(404);
      expect((error as AuthzError).details).toEqual({
        action: "patient:read",
        reason: "OUT_OF_SCOPE",
      });
    }

    try {
      assertCan(makeActor("ANM"), "audit:read", facilityTarget(VILLAGE_PATH));
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthzError);
      expect((error as AuthzError).code).toBe("FORBIDDEN");
      expect((error as AuthzError).httpStatus).toBe(403);
      expect((error as AuthzError).details).toEqual({
        action: "audit:read",
        reason: "ROLE_NOT_PERMITTED",
      });
    }
  });
});
