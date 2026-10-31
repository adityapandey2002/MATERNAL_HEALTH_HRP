import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";
import type { DB } from "../db/types.js";
import {
  followUpLevelForRole,
  nextFieldFollowUpValues,
  resolveInitialFollowUpOwner,
} from "./hrp-follow-up.js";

/** Minimal Kysely stand-in: each `selectFrom` returns the next queued user id. */
function makeDatabase(results: Array<string | null>): Kysely<DB> {
  let index = 0;

  function builder() {
    const id = results[index++] ?? null;
    const chain = {
      innerJoin: () => chain,
      select: () => chain,
      where: () => chain,
      orderBy: () => chain,
      executeTakeFirst: async () => (id ? { id } : undefined),
    };
    return chain;
  }

  return { selectFrom: builder } as unknown as Kysely<DB>;
}

describe("followUpLevelForRole", () => {
  it("maps field roles to their clinical tier", () => {
    expect(followUpLevelForRole("ANM")).toBe("ANM");
    expect(followUpLevelForRole("CHO")).toBe("CHO");
  });

  it("maps every oversight role to the block nodal tier", () => {
    expect(followUpLevelForRole("HRP_HELPDESK_BLOCK")).toBe("BLOCK_NODAL");
    expect(followUpLevelForRole("BHM")).toBe("BLOCK_NODAL");
    expect(followUpLevelForRole("HRP_HELPDESK_DISTRICT")).toBe("BLOCK_NODAL");
    expect(followUpLevelForRole("DHS")).toBe("BLOCK_NODAL");
  });
});

describe("nextFieldFollowUpValues", () => {
  const completedAt = new Date("2026-10-31T06:00:00.000Z");

  it("schedules the next field cycle 15 days after completion", () => {
    const values = nextFieldFollowUpValues({
      patientId: "patient-1",
      registrantUserId: "anm-1",
      registrantRole: "ANM",
      assignedByUserId: "helpdesk-1",
      completedAt,
    });

    expect(values.track).toBe("FIELD_15_DAY");
    expect(values.level).toBe("ANM");
    expect(values.assigned_to_user_id).toBe("anm-1");
    expect(values.assigned_by_user_id).toBe("helpdesk-1");
    expect(values.scheduled_date).toEqual(new Date("2026-11-15T06:00:00.000Z"));
  });

  it("keeps the CHO tier label when a CHO registered the woman", () => {
    const values = nextFieldFollowUpValues({
      patientId: "patient-1",
      registrantUserId: "cho-1",
      registrantRole: "CHO",
      assignedByUserId: "bhm-1",
      completedAt,
    });

    expect(values.level).toBe("CHO");
  });

  it("falls back to the ANM tier when the registrant role is unknown", () => {
    const values = nextFieldFollowUpValues({
      patientId: "patient-1",
      registrantUserId: "legacy-1",
      registrantRole: null,
      assignedByUserId: "bhm-1",
      completedAt,
    });

    expect(values.level).toBe("ANM");
  });
});

describe("resolveInitialFollowUpOwner", () => {
  const actor = { userId: "anm-1", role: "ANM" as const };

  it("keeps a non-referred HRP with the registering worker", async () => {
    const owner = await resolveInitialFollowUpOwner(makeDatabase([]), {
      facilityPath: "district.block.hwc.village",
      actor,
      track: "FIELD_15_DAY",
    });

    expect(owner).toEqual({ userId: "anm-1", level: "ANM" });
  });

  it("assigns a referred HRP to the deepest active block helpdesk", async () => {
    const owner = await resolveInitialFollowUpOwner(makeDatabase(["helpdesk-1"]), {
      facilityPath: "district.block.hwc.village",
      actor,
      track: "BLOCK_15_DAY",
    });

    expect(owner).toEqual({ userId: "helpdesk-1", level: "BLOCK_NODAL" });
  });

  it("falls back to the block BHM when no block helpdesk exists", async () => {
    const owner = await resolveInitialFollowUpOwner(makeDatabase([null, "bhm-1"]), {
      facilityPath: "district.block.hwc.village",
      actor,
      track: "BLOCK_15_DAY",
    });

    expect(owner).toEqual({ userId: "bhm-1", level: "BLOCK_NODAL" });
  });

  it("falls back to the registering worker when the block has no oversight account", async () => {
    const owner = await resolveInitialFollowUpOwner(makeDatabase([null, null]), {
      facilityPath: "district.block.hwc.village",
      actor,
      track: "BLOCK_15_DAY",
    });

    expect(owner).toEqual({ userId: "anm-1", level: "BLOCK_NODAL" });
  });
});
