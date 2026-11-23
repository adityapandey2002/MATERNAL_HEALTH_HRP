import { describe, expect, it } from "vitest";
import { computeFollowUpNotes } from "./follow-ups.js";

describe("computeFollowUpNotes", () => {
  it("appends [FCM: Administered] tag when fcmAdministered is true", () => {
    expect(computeFollowUpNotes("Patient counselled", true)).toBe(
      "Patient counselled [FCM: Administered]"
    );
  });

  it("creates [FCM: Administered] when notes was null or empty", () => {
    expect(computeFollowUpNotes(null, true)).toBe("[FCM: Administered]");
    expect(computeFollowUpNotes(undefined, true)).toBe("[FCM: Administered]");
    expect(computeFollowUpNotes("", true)).toBe("[FCM: Administered]");
  });

  it("does not duplicate [FCM: Administered] tag if already present", () => {
    expect(computeFollowUpNotes("Already [FCM: Administered]", true)).toBe(
      "Already [FCM: Administered]"
    );
  });

  it("removes [FCM: Administered] tag when fcmAdministered is false", () => {
    expect(computeFollowUpNotes("Patient visited [FCM: Administered]", false)).toBe(
      "Patient visited"
    );
    expect(computeFollowUpNotes("[FCM: Administered]", false)).toBeNull();
  });

  it("preserves notes unchanged when fcmAdministered is undefined or null", () => {
    expect(computeFollowUpNotes("Standard notes", undefined)).toBe("Standard notes");
    expect(computeFollowUpNotes("Standard notes", null)).toBe("Standard notes");
  });
});
