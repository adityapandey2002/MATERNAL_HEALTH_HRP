import type { HrpFollowUpStatus, HrpFollowUpTrack } from "./types.js";

/**
 * Copy for the three-track HRP follow-up engine.
 *
 * Field panels, the block helpdesk and the dashboard all render the same
 * tracks and statuses, so the labels live here instead of being repeated (and
 * drifting) in each page.
 */
export interface HrpTrackOption {
  value: HrpFollowUpTrack;
  label: string;
  shortLabel: string;
  description: string;
}

export const HRP_FOLLOW_UP_TRACKS: HrpTrackOption[] = [
  {
    value: "IMMEDIATE_7_DAYS",
    label: "Immediate 7-day window",
    shortLabel: "7-day",
    description: "Urgent doctor / MO clinical evaluation at CHC for critical warning signs",
  },
  {
    value: "PMSMA_SESSION",
    label: "Next PMSMA session at PHC",
    shortLabel: "PMSMA",
    description: "Specialist check-up on the 9th, 15th or 21st — whichever comes first",
  },
  {
    value: "VHSND_COMMUNITY",
    label: "Community VHSND session",
    shortLabel: "VHSND",
    description: "Village Health, Sanitation and Nutrition Day session by the local ANM",
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
  return getHrpTrack(value)?.label ?? "No track";
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

/**
 * Picks the track a woman enters when no follow-up record exists yet.
 *
 * Referred and red-flagged pregnancies need an MO review inside seven days;
 * everything else joins the next PMSMA or VHSND session.
 */
export function inferHrpTrack(patient: {
  referred?: boolean | null;
  riskLevel?: "GREEN" | "AMBER" | "RED" | null;
}): HrpFollowUpTrack {
  if (patient.referred || patient.riskLevel === "RED") return "IMMEDIATE_7_DAYS";
  if (patient.riskLevel === "AMBER") return "PMSMA_SESSION";
  return "VHSND_COMMUNITY";
}
