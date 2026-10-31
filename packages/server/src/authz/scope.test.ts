import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import type { DB } from "../db/types.js";
import {
  AuthzError,
  assertRequestedScope,
  buildActorScope,
  createDbActorLookup,
  escapeLikePattern,
  isFacilityRoleCompatible,
  isPathInSubtree,
  pathSubtreeLikePattern,
  resolveActor,
} from "./scope.js";
import type { ActorFacilityRecord, ActorLookup, ActorUserRecord } from "./scope.js";

const HWC_PATH = "INDIA.BIHAR.ARARIA.RANIGANJ.PHC_KUHA.HWC_PASUNJ";
const VILLAGE_PATH = `${HWC_PATH}.VIL_PAS`;
const BLOCK_PATH = "INDIA.BIHAR.ARARIA.RANIGANJ";
const SIBLING_PATH = "INDIA.BIHAR.ARARIA.RANIGANJ.PHC_KUHA.HWC_BALUA";

const activeUser: ActorUserRecord = {
  id: "user-1",
  role: "ANM",
  facilityId: "fac-village",
  isActive: true,
};

const villageFacility: ActorFacilityRecord = {
  id: "fac-village",
  path: VILLAGE_PATH,
  level: "VILLAGE",
};

function expectAuthzError(error: unknown, code: AuthzError["code"]): void {
  expect(error).toBeInstanceOf(AuthzError);
  expect((error as AuthzError).code).toBe(code);
}

describe("isPathInSubtree", () => {
  it("matches the exact path and descendants", () => {
    expect(isPathInSubtree(BLOCK_PATH, BLOCK_PATH)).toBe(true);
    expect(isPathInSubtree(BLOCK_PATH, HWC_PATH)).toBe(true);
    expect(isPathInSubtree(HWC_PATH, VILLAGE_PATH)).toBe(true);
  });

  it("rejects siblings and ancestors", () => {
    expect(isPathInSubtree(HWC_PATH, SIBLING_PATH)).toBe(false);
    expect(isPathInSubtree(VILLAGE_PATH, HWC_PATH)).toBe(false);
  });

  it("does not treat a shared code prefix as a descendant", () => {
    expect(isPathInSubtree("INDIA.BIHAR.ARARIA.HWC_PAS", "INDIA.BIHAR.ARARIA.HWC_PASUNJ")).toBe(
      false
    );
    expect(isPathInSubtree("INDIA.BIHAR.ARARIA.HWC", "INDIA.BIHAR.ARARIA.HWC_PASUNJ")).toBe(false);
  });

  it("rejects empty paths", () => {
    expect(isPathInSubtree("", VILLAGE_PATH)).toBe(false);
    expect(isPathInSubtree(VILLAGE_PATH, "")).toBe(false);
  });
});

describe("LIKE path helpers", () => {
  it("escapes wildcard and escape characters", () => {
    expect(escapeLikePattern("HWC_PAS")).toBe("HWC\\_PAS");
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("A\\B")).toBe("A\\\\B");
  });

  it("builds a descendant LIKE pattern with escaped underscores", () => {
    expect(pathSubtreeLikePattern(HWC_PATH)).toBe(
      "INDIA.BIHAR.ARARIA.RANIGANJ.PHC\\_KUHA.HWC\\_PASUNJ.%"
    );
  });
});

describe("isFacilityRoleCompatible", () => {
  it("maps ANM to village and HSC facilities", () => {
    expect(isFacilityRoleCompatible("ANM", "VILLAGE")).toBe(true);
    expect(isFacilityRoleCompatible("ANM", "HSC")).toBe(true);
    expect(isFacilityRoleCompatible("ANM", "HWC")).toBe(true);
  });

  it("maps CHO, BHM and DHS to their levels", () => {
    expect(isFacilityRoleCompatible("CHO", "HWC")).toBe(true);
    expect(isFacilityRoleCompatible("CHO", "PHC")).toBe(true);
    expect(isFacilityRoleCompatible("BHM", "BLOCK")).toBe(true);
    expect(isFacilityRoleCompatible("BHM", "CHC")).toBe(true);
    expect(isFacilityRoleCompatible("BHM", "DISTRICT")).toBe(false);
    expect(isFacilityRoleCompatible("DHS", "DISTRICT")).toBe(true);
    expect(isFacilityRoleCompatible("DHS", "BLOCK")).toBe(false);
  });
});

describe("buildActorScope", () => {
  it("builds a scope with referral nodal grants", () => {
    const actor = buildActorScope(activeUser, villageFacility, [
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "fac-block",
        scopePath: BLOCK_PATH,
      },
    ]);

    expect(actor).toEqual({
      userId: "user-1",
      role: "ANM",
      facilityId: "fac-village",
      facilityPath: VILLAGE_PATH,
      facilityLevel: "VILLAGE",
      homeFacilityId: "fac-village",
      homeFacilityPath: VILLAGE_PATH,
      homeFacilityLevel: "VILLAGE",
      responsibilities: [
        {
          responsibility: "REFERRAL_NODAL",
          scopeFacilityId: "fac-block",
          scopePath: BLOCK_PATH,
        },
      ],
    });
  });

  it("ignores unsupported responsibilities and grants without a path", () => {
    const actor = buildActorScope(activeUser, villageFacility, [
      { responsibility: "SOMETHING_ELSE", scopeFacilityId: "fac-1", scopePath: BLOCK_PATH },
      { responsibility: "REFERRAL_NODAL", scopeFacilityId: "fac-2", scopePath: "" },
    ]);

    expect(actor.responsibilities).toEqual([]);
  });

  it("rejects inactive users", () => {
    expect(() => buildActorScope({ ...activeUser, isActive: false }, villageFacility)).toThrow(
      AuthzError
    );

    try {
      buildActorScope({ ...activeUser, isActive: false }, villageFacility);
    } catch (error) {
      expectAuthzError(error, "INACTIVE_USER");
    }
  });

  it("rejects retired and unknown roles", () => {
    for (const role of ["MO", "DISTRICT_ADMIN", "ASHA", "STATE_ADMIN", "NOBODY"]) {
      try {
        buildActorScope({ ...activeUser, role }, villageFacility);
        throw new Error("Expected an AuthzError");
      } catch (error) {
        expectAuthzError(error, "UNKNOWN_ROLE");
      }
    }
  });

  it("rejects role and facility mismatches", () => {
    try {
      buildActorScope({ ...activeUser, role: "CHO" }, villageFacility);
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "ROLE_FACILITY_MISMATCH");
    }
  });

  it("rejects a user whose record points at a different facility", () => {
    try {
      buildActorScope({ ...activeUser, facilityId: "fac-other" }, villageFacility);
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "USER_FACILITY_MISMATCH");
    }
  });

  it("rejects a facility without a path or with an unknown level", () => {
    try {
      buildActorScope(activeUser, { ...villageFacility, path: "" });
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_FACILITY");
    }

    try {
      buildActorScope(activeUser, { ...villageFacility, level: "SUBDISTRICT" });
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_FACILITY");
    }
  });
});

describe("resolveActor", () => {
  function makeLookup(overrides: Partial<ActorLookup> = {}): ActorLookup {
    return {
      findUser: async () => activeUser,
      findFacility: async () => villageFacility,
      findResponsibilities: async () => [],
      ...overrides,
    };
  }

  it("resolves the user, facility and responsibilities from the lookup", async () => {
    const actor = await resolveActor(
      "user-1",
      makeLookup({
        findResponsibilities: async () => [
          {
            responsibility: "REFERRAL_NODAL",
            scopeFacilityId: "fac-block",
            scopePath: BLOCK_PATH,
          },
        ],
      })
    );

    expect(actor.userId).toBe("user-1");
    expect(actor.facilityPath).toBe(VILLAGE_PATH);
    expect(actor.responsibilities).toHaveLength(1);
  });

  it("rejects an unknown user", async () => {
    try {
      await resolveActor("missing", makeLookup({ findUser: async () => null }));
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_USER");
    }
  });

  it("rejects an inactive user", async () => {
    try {
      await resolveActor(
        "user-1",
        makeLookup({ findUser: async () => ({ ...activeUser, isActive: false }) })
      );
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "INACTIVE_USER");
    }
  });

  it("rejects a legacy role returned by the database", async () => {
    try {
      await resolveActor(
        "user-1",
        makeLookup({ findUser: async () => ({ ...activeUser, role: "DISTRICT_ADMIN" }) })
      );
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_ROLE");
    }
  });

  it("rejects a missing facility", async () => {
    try {
      await resolveActor("user-1", makeLookup({ findFacility: async () => null }));
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_FACILITY");
    }
  });
});

describe("assertRequestedScope", () => {
  const actor = buildActorScope(
    { ...activeUser, role: "CHO", facilityId: "fac-hwc" },
    { id: "fac-hwc", path: HWC_PATH, level: "HWC" }
  );

  const lookup = {
    findFacility: async (facilityId: string): Promise<ActorFacilityRecord | null> => {
      if (facilityId === "fac-village") {
        return { id: "fac-village", path: VILLAGE_PATH, level: "VILLAGE" };
      }
      if (facilityId === "fac-block") {
        return { id: "fac-block", path: BLOCK_PATH, level: "BLOCK" };
      }
      if (facilityId === "fac-sibling") {
        return { id: "fac-sibling", path: SIBLING_PATH, level: "HWC" };
      }
      if (facilityId === "fac-odd") {
        return { id: "fac-odd", path: VILLAGE_PATH, level: "SUBDISTRICT" };
      }
      return null;
    },
  };

  it("returns the actor scope when no facility is requested", async () => {
    expect(await assertRequestedScope(actor, undefined, lookup)).toBe(actor);
    expect(await assertRequestedScope(actor, null, lookup)).toBe(actor);
  });

  it("returns the actor scope when the actor facility is requested", async () => {
    expect(await assertRequestedScope(actor, "fac-hwc", lookup)).toBe(actor);
  });

  it("narrows to a descendant facility without losing the home scope", async () => {
    const narrowed = await assertRequestedScope(actor, "fac-village", lookup);

    expect(narrowed.facilityId).toBe("fac-village");
    expect(narrowed.facilityPath).toBe(VILLAGE_PATH);
    expect(narrowed.facilityLevel).toBe("VILLAGE");
    expect(narrowed.role).toBe("CHO");
    expect(narrowed.homeFacilityId).toBe("fac-hwc");
    expect(narrowed.homeFacilityPath).toBe(HWC_PATH);
    expect(narrowed.homeFacilityLevel).toBe("HWC");
  });

  it("keeps only responsibility grants inside the requested subtree", async () => {
    const actorWithGrants = buildActorScope(
      { ...activeUser, role: "CHO", facilityId: "fac-hwc" },
      { id: "fac-hwc", path: HWC_PATH, level: "HWC" },
      [
        {
          responsibility: "REFERRAL_NODAL",
          scopeFacilityId: "fac-village",
          scopePath: VILLAGE_PATH,
        },
        {
          responsibility: "REFERRAL_NODAL",
          scopeFacilityId: "fac-block",
          scopePath: BLOCK_PATH,
        },
        {
          responsibility: "REFERRAL_NODAL",
          scopeFacilityId: "fac-sibling",
          scopePath: SIBLING_PATH,
        },
      ]
    );

    const narrowed = await assertRequestedScope(actorWithGrants, "fac-village", lookup);

    expect(narrowed.responsibilities).toEqual([
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "fac-village",
        scopePath: VILLAGE_PATH,
      },
    ]);
  });

  it("rejects widening to an ancestor or sibling", async () => {
    for (const facilityId of ["fac-block", "fac-sibling"]) {
      try {
        await assertRequestedScope(actor, facilityId, lookup);
        throw new Error("Expected an AuthzError");
      } catch (error) {
        expectAuthzError(error, "SCOPE_WIDENING");
      }
    }
  });

  it("rejects an unknown or malformed requested facility", async () => {
    try {
      await assertRequestedScope(actor, "missing", lookup);
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_FACILITY");
    }

    try {
      await assertRequestedScope(actor, "fac-odd", lookup);
      throw new Error("Expected an AuthzError");
    } catch (error) {
      expectAuthzError(error, "UNKNOWN_FACILITY");
    }
  });
});

describe("createDbActorLookup", () => {
  interface FakeRows {
    user?: { id: string; role: string; facility_id: string; is_active: boolean };
    facility?: { id: string; path: string; level: string };
    responsibilities?: Array<{
      responsibility: string;
      scope_facility_id: string;
      scope_path: string;
    }>;
  }

  function makeDatabase(rows: FakeRows): Kysely<DB> {
    function builder(table: string) {
      const chain = {
        select: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        executeTakeFirst: async () => (table === "users" ? rows.user : rows.facility),
        execute: async () => rows.responsibilities ?? [],
      };
      return chain;
    }

    return {
      selectFrom: (table: string) => builder(table),
    } as unknown as Kysely<DB>;
  }

  it("maps user and facility rows to lookup records", async () => {
    const lookup = createDbActorLookup(
      makeDatabase({
        user: { id: "user-1", role: "ANM", facility_id: "fac-village", is_active: true },
        facility: { id: "fac-village", path: VILLAGE_PATH, level: "VILLAGE" },
      })
    );

    expect(await lookup.findUser("user-1")).toEqual({
      id: "user-1",
      role: "ANM",
      facilityId: "fac-village",
      isActive: true,
    });
    expect(await lookup.findFacility("fac-village")).toEqual({
      id: "fac-village",
      path: VILLAGE_PATH,
      level: "VILLAGE",
    });
  });

  it("returns null when rows are absent", async () => {
    const lookup = createDbActorLookup(makeDatabase({}));

    expect(await lookup.findUser("missing")).toBeNull();
    expect(await lookup.findFacility("missing")).toBeNull();
  });

  it("maps responsibility rows with their scope path", async () => {
    const lookup = createDbActorLookup(
      makeDatabase({
        responsibilities: [
          {
            responsibility: "REFERRAL_NODAL",
            scope_facility_id: "fac-block",
            scope_path: BLOCK_PATH,
          },
        ],
      })
    );

    expect(await lookup.findResponsibilities("user-1")).toEqual([
      {
        responsibility: "REFERRAL_NODAL",
        scopeFacilityId: "fac-block",
        scopePath: BLOCK_PATH,
      },
    ]);
  });
});
