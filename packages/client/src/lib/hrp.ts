import {
  type HrpComplication,
  type HrpFollowUpStatus,
  type HrpFollowUpTrack,
  type Patient,
  type RiskLevel,
  getNextPmsmaDate,
  inferHrpTrack,
} from "@hrp/shared";
import type { FollowUpListItem } from "@hrp/shared/schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The expected date of delivery is LMP + 280 days. */
export function eddFromLmp(lmp: Date): Date {
  const edd = new Date(lmp.getFullYear(), lmp.getMonth(), lmp.getDate());
  edd.setDate(edd.getDate() + 280);
  return edd;
}

export interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
}

/** Completed weeks and days between LMP and today. */
export function gestationalAge(lmp: Date, at: Date = new Date()): GestationalAge {
  const from = new Date(lmp.getFullYear(), lmp.getMonth(), lmp.getDate());
  const to = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const totalDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays };
}

export function gestationalAgeLabel(lmp: Date, at: Date = new Date()): string {
  const { weeks, days } = gestationalAge(lmp, at);
  return `${weeks}w ${days}d`;
}

/**
 * A single woman on the follow-up line list.
 *
 * The row is assembled from a server follow-up record when one exists, and
 * otherwise from the patient's own track/schedule so a newly registered woman
 * never disappears from the panel.
 */
export interface FollowUpRow {
  key: string;
  patientId: string;
  followUpId: string | null;
  patientName: string;
  age: number;
  phone: string | null;
  ashaPhone: string | null;
  village: string | null;
  complication: HrpComplication | null;
  riskLevel: RiskLevel;
  track: HrpFollowUpTrack;
  status: HrpFollowUpStatus;
  scheduledDate: Date;
  /** Last time the row changed — used as the "last attempt" stamp. */
  lastAttemptAt: Date | null;
  assignedToName: string | null;
  assignedToRole: string | null;
  completedByName: string | null;
  completedByRole: string | null;
  notes: string | null;
}

const STATUS_ORDER: Record<HrpFollowUpStatus, number> = {
  PENDING: 0,
  NOT_REACHABLE: 1,
  COMPLETE: 2,
};

const ACTIVE_STATUSES: ReadonlySet<HrpFollowUpStatus> = new Set(["PENDING", "NOT_REACHABLE"]);

function defaultScheduledDate(track: HrpFollowUpTrack, village: string | null, now: Date): Date {
  if (track === "IMMEDIATE_7_DAYS") return new Date(now.getTime() + 7 * DAY_MS);
  if (track === "PMSMA_SESSION") return getNextPmsmaDate(now);
  return new Date(now.getTime() + 30 * DAY_MS);
}

/** Picks the row that represents a woman's current contact. */
function pickRecord(records: FollowUpListItem[]): FollowUpListItem | undefined {
  if (records.length === 0) return undefined;
  const sorted = [...records].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  );
  const active = sorted.find((record) => ACTIVE_STATUSES.has(record.status));
  return active ?? sorted[sorted.length - 1];
}

/**
 * Merge the server line list with the patient register.
 *
 * One row per woman: the active follow-up record wins, then her own scheduled
 * track, then the track inferred from referral and risk level.
 */
export function buildFollowUpLineList(
  patients: Patient[],
  records: FollowUpListItem[],
  now: Date = new Date()
): FollowUpRow[] {
  const recordsByPatient = new Map<string, FollowUpListItem[]>();
  for (const record of records) {
    const list = recordsByPatient.get(record.patientId) ?? [];
    list.push(record);
    recordsByPatient.set(record.patientId, list);
  }

  const patientById = new Map(patients.map((patient) => [patient.id, patient]));

  // Include a record whose patient is outside the first page of the register,
  // otherwise a long block list silently drops rows.
  const patientIds = new Set([...patientById.keys(), ...recordsByPatient.keys()]);

  const rows: FollowUpRow[] = [];
  for (const patientId of patientIds) {
    const patient = patientById.get(patientId);
    const record = pickRecord(recordsByPatient.get(patientId) ?? []);

    const track =
      record?.track ??
      patient?.followUpTrack ??
      inferHrpTrack({ referred: patient?.referred, riskLevel: patient?.riskLevel });
    const scheduledDate = record
      ? new Date(record.scheduledDate)
      : patient?.followUpScheduledDate
        ? new Date(patient.followUpScheduledDate)
        : defaultScheduledDate(track, record?.village ?? null, now);

    rows.push({
      key: record ? `follow-up-${record.id}` : `patient-${patientId}`,
      patientId,
      followUpId: record?.id ?? null,
      patientName: record?.patientName ?? patient?.name ?? "Unknown woman",
      age: record?.patientAge ?? patient?.age ?? 0,
      phone: record?.patientPhone ?? patient?.phone ?? null,
      ashaPhone: patient?.ashaPhone ?? null,
      village: record?.village ?? patient?.address ?? null,
      complication: record?.hrpComplication ?? patient?.hrpComplication ?? null,
      riskLevel: record?.patientRiskLevel ?? patient?.riskLevel ?? "GREEN",
      track,
      status: record?.status ?? patient?.followUpStatus ?? "PENDING",
      scheduledDate,
      lastAttemptAt: record ? new Date(record.updatedAt) : null,
      assignedToName: record?.assignedToName ?? null,
      assignedToRole: record?.assignedToRole ?? null,
      completedByName: record?.completedByName ?? null,
      completedByRole: record?.completedByRole ?? null,
      notes: record?.notes ?? null,
    });
  }

  return rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.scheduledDate.getTime() - b.scheduledDate.getTime() ||
      a.patientName.localeCompare(b.patientName)
  );
}

export function isBreached(row: FollowUpRow, now: Date = new Date()): boolean {
  return row.status === "PENDING" && row.scheduledDate.getTime() < startOfToday(now).getTime();
}

export interface TrackSummary {
  total: number;
  pending: number;
  complete: number;
  notReachable: number;
  breached: number;
}

export interface FollowUpSummary {
  total: number;
  pending: number;
  complete: number;
  notReachable: number;
  breached: number;
  complianceRate: number;
  nextPmsmaDate: Date;
  pmsmaCohort: number;
  byTrack: Record<HrpFollowUpTrack, TrackSummary>;
}

function emptyTrack(): TrackSummary {
  return { total: 0, pending: 0, complete: 0, notReachable: 0, breached: 0 };
}

/**
 * Block dashboard counters. Everything is derived from the same line list the
 * panel renders, so the tiles and the table can never disagree.
 */
export function summariseFollowUps(
  rows: FollowUpRow[],
  now: Date = new Date()
): FollowUpSummary {
  const byTrack: Record<HrpFollowUpTrack, TrackSummary> = {
    IMMEDIATE_7_DAYS: emptyTrack(),
    PMSMA_SESSION: emptyTrack(),
    VHSND_COMMUNITY: emptyTrack(),
  };

  let pending = 0;
  let complete = 0;
  let notReachable = 0;
  let breached = 0;

  for (const row of rows) {
    const track = byTrack[row.track];
    track.total += 1;

    if (row.status === "PENDING") {
      pending += 1;
      track.pending += 1;
      if (isBreached(row, now)) {
        breached += 1;
        track.breached += 1;
      }
    } else if (row.status === "COMPLETE") {
      complete += 1;
      track.complete += 1;
    } else {
      notReachable += 1;
      track.notReachable += 1;
    }
  }

  const total = rows.length;
  return {
    total,
    pending,
    complete,
    notReachable,
    breached,
    complianceRate: total === 0 ? 0 : Math.round((complete / total) * 100),
    nextPmsmaDate: getNextPmsmaDate(now),
    pmsmaCohort: byTrack.PMSMA_SESSION.total,
    byTrack,
  };
}

/** Attribution copy used by the block's shared line list. */
export function attributionLabel(row: FollowUpRow): string {
  if (row.completedByName) {
    const tier = row.completedByRole ? humanTier(row.completedByRole) : "field team";
    return `Done by ${tier} (${row.completedByName})`;
  }
  if (row.assignedToName) {
    const tier = row.assignedToRole ? humanTier(row.assignedToRole) : "field team";
    return `Assigned to ${tier} (${row.assignedToName})`;
  }
  return "Unassigned / Pending field outreach";
}

function humanTier(role: string): string {
  if (role === "HELPDESK") return "HRP_Helpdesk";
  if (role === "BHM") return "Block Nodal";
  if (role === "DHS") return "District Nodal";
  return role;
}

/** "15 Oct" style label for the next PMSMA cohort tile. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
