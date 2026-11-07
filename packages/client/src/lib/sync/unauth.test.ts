import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullCohort } from "./pull";
import { drain } from "./queue";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  localStorage.clear();
});

/**
 * Background sync runs from lifecycle listeners that fire before anyone signs
 * in. Without a token the request would 401, and a 401 used to navigate back to
 * /login — reloading the form the ANM was typing into.
 */
describe("sync before sign-in", () => {
  it("does not push the queue without an access token", async () => {
    await drain();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not pull the cohort without an access token", async () => {
    await pullCohort();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
