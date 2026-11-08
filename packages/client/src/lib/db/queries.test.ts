import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./local-db";
import { useLocalPatients, useLocalVisits } from "./queries";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("local read resilience", () => {
  it("returns an empty list instead of throwing when the local database is unavailable", async () => {
    // A closed database (evicted storage, a corrupt upgrade) used to reject the
    // live query, which React re-threw during render and blanked the screen.
    await db.close();

    const patients = renderHook(() => useLocalPatients());
    const visits = renderHook(() => useLocalVisits());

    await waitFor(() => expect(patients.result.current).toEqual([]));
    await waitFor(() => expect(visits.result.current).toEqual([]));
  });
});
