import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  markFailed: vi.fn(),
  pendingCount: vi.fn(),
  conflictCount: vi.fn(),
  conflictAdd: vi.fn(),
  metaGet: vi.fn(),
  metaSet: vi.fn(),
  patientUpsert: vi.fn(),
  patientGet: vi.fn(),
  visitUpsert: vi.fn(),
  visitGet: vi.fn(),
  followUpUpsert: vi.fn(),
  followUpGet: vi.fn(),
}));

vi.mock("../api", () => ({ api: { sync: { push: mocks.push } } }));
vi.mock("../crypto", () => ({ canUseLocalData: () => true }));
vi.mock("../token-store", () => ({ hasAccessToken: () => true }));
vi.mock("../db/repositories", () => ({
  opRepo: {
    list: mocks.list,
    remove: mocks.remove,
    markFailed: mocks.markFailed,
    count: mocks.pendingCount,
  },
  conflictRepo: { count: mocks.conflictCount, add: mocks.conflictAdd },
  metaRepo: { get: mocks.metaGet, set: mocks.metaSet },
  patientRepo: { upsert: mocks.patientUpsert, get: mocks.patientGet },
  visitRepo: { upsert: mocks.visitUpsert, get: mocks.visitGet },
  followUpRepo: { upsert: mocks.followUpUpsert, get: mocks.followUpGet },
}));

import { drain } from "./queue";

const pendingPatient = {
  seq: 7,
  entityType: "patient" as const,
  entityId: "p1",
  op: "create" as const,
  payload: { id: "p1" },
  clientUpdatedAt: "2026-11-07T10:00:00.000Z",
  attempts: 0,
  lastError: null,
  nextAttemptAt: 0,
  createdAt: "2026-11-07T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([pendingPatient]);
  mocks.pendingCount.mockResolvedValue(0);
  mocks.conflictCount.mockResolvedValue(0);
  mocks.metaGet.mockResolvedValue(null);
  mocks.push.mockResolvedValue({
    serverTimestamp: "2026-11-07T10:01:00.000Z",
    conflicts: [],
    rejected: [],
  });
});

describe("sync queue", () => {
  it("removes a change the server accepted", async () => {
    await drain();

    expect(mocks.remove).toHaveBeenCalledWith(7);
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });

  it("keeps a server-rejected change queued with the server's reason", async () => {
    mocks.push.mockResolvedValue({
      serverTimestamp: "2026-11-07T10:01:00.000Z",
      conflicts: [],
      rejected: [
        { entityType: "PATIENT", entityId: "p1", reason: "facility is not in your scope" },
      ],
    });

    await drain();

    // Dropping the op here is how an ANM registration went missing at block
    // level: the phone showed the patient, the server never stored her.
    expect(mocks.markFailed).toHaveBeenCalledWith(
      7,
      "facility is not in your scope",
      expect.any(Number)
    );
    expect(mocks.remove).not.toHaveBeenCalled();

    const call = mocks.markFailed.mock.calls[0];
    const nextAttemptAt = Number(call?.[2]);
    expect(nextAttemptAt).toBeGreaterThan(Date.now());
  });
});
