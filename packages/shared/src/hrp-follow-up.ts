import type { HrpFollowUpStatus, HrpFollowUpTrack } from "./types.js";

/**
 * Copy for the 15-day HRP follow-up engine.
 *
 * Every woman marked HRP repeats a 15-day cycle. The first cycle of a referred
 * woman is owned by the Block HRP Helpdesk; every later cycle is worked by the
 * field team and visible to the block at the same time.
 */
export interface HrpTrackOption {
  value: HrpFollowUpTrack;
  label: string;
  shortLabel: string;
  description: string;
}

export const HRP_FOLLOW_UP_TRACKS: HrpTrackOption[] = [
  {
    value: "BLOCK_15_DAY",
    label: "Block HRP Helpdesk · 15-day window",
    shortLabel: "Block review",
    description:
      "Referred HRP case. The block helpdesk completes the first check-up before the 15-day window closes.",
  },
  {
    value: "FIELD_15_DAY",
    label: "Field follow-up · 15-day window",
    shortLabel: "Field 15-day",
    description:
      "ANM / CHO contact every 15 days. The block helpdesk sees and can close the same row.",
  },
];

export interface HrpStatusOption {
  value: HrpFollowUpStatus;
  label: string;
  /** CSS modifier used by the shared badge styles. */
  badge: "badge-green" | "badge-amber" | "badge-gray";
}

export const HRP_FOLLOW_UP_STATUSES: HrpStatusOption[] = [
  { value: "COMPLETE", label: "Complete", badge: "badge-green" },
  { value: "PENDING", label: "Pending", badge: "badge-amber" },
  { value: "NOT_REACHABLE", label: "Not reachable", badge: "badge-gray" },
];

const TRACK_BY_VALUE = new Map(HRP_FOLLOW_UP_TRACKS.map((track) => [track.value, track]));
const STATUS_BY_VALUE = new Map(HRP_FOLLOW_UP_STATUSES.map((status) => [status.value, status]));

export function getHrpTrack(
  value: HrpFollowUpTrack | null | undefined
): HrpTrackOption | undefined {
  return value ? TRACK_BY_VALUE.get(value) : undefined;
}

export function getHrpTrackLabel(value: HrpFollowUpTrack | null | undefined): string {
  return getHrpTrack(value)?.label ?? "No follow-up stage";
}

export function getHrpTrackShortLabel(value: HrpFollowUpTrack | null | undefined): string {
  return getHrpTrack(value)?.shortLabel ?? "Untracked";
}

export function getHrpStatus(
  value: HrpFollowUpStatus | null | undefined
): HrpStatusOption | undefined {
  return value ? STATUS_BY_VALUE.get(value) : undefined;
}

export function getHrpStatusLabel(value: HrpFollowUpStatus | null | undefined): string {
  return getHrpStatus(value)?.label ?? "Pending";
}

export function getHrpStatusBadge(value: HrpFollowUpStatus | null | undefined): string {
  return getHrpStatus(value)?.badge ?? "badge-amber";
}

/** True when the row is the block-owned first cycle of a referred HRP. */
export function isBlockStage(track: HrpFollowUpTrack | null | undefined): boolean {
  return track === "BLOCK_15_DAY";
}

/**
 * Picks the stage a woman enters when no follow-up record exists yet.
 *
 * A referred HRP starts with the block helpdesk; everyone else starts in the
 * field 15-day cycle.
 */
export function inferHrpTrack(patient: {
  referred?: boolean | null;
  riskLevel?: "GREEN" | "AMBER" | "RED" | null;
}): HrpFollowUpTrack {
  return patient.referred ? "BLOCK_15_DAY" : "FIELD_15_DAY";
}
