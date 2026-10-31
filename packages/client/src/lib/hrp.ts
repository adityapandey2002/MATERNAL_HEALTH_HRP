import {
  HRP_FOLLOW_UP_WINDOW_DAYS,
  type HrpComplication,
  type HrpFollowUpStatus,
  type HrpFollowUpTrack,
  type Patient,
  type RiskLevel,
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
 * otherwise from the patient's own stage/schedule so a newly registered woman
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
  /** Block the woman's facility belongs to; null on block-scoped responses. */
  blockName: string | null;
  complication: HrpComplication | null;
  riskLevel: RiskLevel;
  /** Stage of the 15-day cycle: block-owned first contact or field cycle. */
  track: HrpFollowUpTrack;
  status: HrpFollowUpStatus;
  scheduledDate: Date;
  /**
   * True when the row is the block helpdesk's first 15-day contact and is still
   * open. The field worker sees it but cannot close it.
   */
  isBlockStage: boolean;
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

/**
 * Both stages use the same 15-day window. The stage only decides who owns the
 * contact: the block helpdesk for a referred woman's first cycle, the field
 * worker for every cycle after that.
 */
function defaultScheduledDate(_track: HrpFollowUpTrack, now: Date): Date {
  return new Date(now.getTime() + HRP_FOLLOW_UP_WINDOW_DAYS * DAY_MS);
}

/** Picks the row that represents a woman's current contact. */
function pickRecord(records: FollowUpListItem[]): FollowUpListItem | undefined {
  if (records.length === 0) return undefined;
  const sorted = [...records].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  );
  const active = sorted.find((record) => ACTIVE_STATUSES.has(record.status));
  // With no open cycle left, the latest completed one is the last contact.
  return active ?? sorted[sorted.length - 1];
}

/**
 * Merge the server line list with the patient register.
 *
 * One row per woman: the active follow-up record wins, then her own scheduled
 * stage, then the stage inferred from referral status. A referred HRP starts
 * with the block helpdesk; everyone else starts in the field cycle.
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
        : defaultScheduledDate(track, now);
    const status = record?.status ?? patient?.followUpStatus ?? "PENDING";

    rows.push({
      key: record ? `follow-up-${record.id}` : `patient-${patientId}`,
      patientId,
      followUpId: record?.id ?? null,
      patientName: record?.patientName ?? patient?.name ?? "Unknown woman",
      age: record?.patientAge ?? patient?.age ?? 0,
      phone: record?.patientPhone ?? patient?.phone ?? null,
      ashaPhone: patient?.ashaPhone ?? null,
      village: record?.village ?? patient?.address ?? null,
      blockName: record?.blockName ?? null,
      complication: record?.hrpComplication ?? patient?.hrpComplication ?? null,
      riskLevel: record?.patientRiskLevel ?? patient?.riskLevel ?? "GREEN",
      track,
      status,
      scheduledDate,
      isBlockStage: track === "BLOCK_15_DAY" && status !== "COMPLETE",
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

/** A pending contact whose due date has already passed. */
export function isBreached(row: FollowUpRow, now: Date = new Date()): boolean {
  return row.status === "PENDING" && row.scheduledDate.getTime() < startOfToday(now).getTime();
}

/**
 * An open cycle past its due date. Escalation is derived from the dates, not
 * stored, so it can never go stale. `NOT_REACHABLE` stays open and escalates
 * too.
 */
export function isEscalated(row: FollowUpRow, now: Date = new Date()): boolean {
  return row.status !== "COMPLETE" && row.scheduledDate.getTime() < startOfToday(now).getTime();
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
  /** Open rows past their due date — the district escalation queue. */
  escalated: number;
  /** Open block-owned first contacts the field team is waiting on. */
  awaitingBlockReview: number;
  complianceRate: number;
  byStage: Record<HrpFollowUpTrack, TrackSummary>;
}

function emptyTrack(): TrackSummary {
  return { total: 0, pending: 0, complete: 0, notReachable: 0, breached: 0 };
}

/**
 * Dashboard counters. Everything is derived from the same line list the panel
 * renders, so the tiles and the table can never disagree.
 */
export function summariseFollowUps(rows: FollowUpRow[], now: Date = new Date()): FollowUpSummary {
  const byStage: Record<HrpFollowUpTrack, TrackSummary> = {
    BLOCK_15_DAY: emptyTrack(),
    FIELD_15_DAY: emptyTrack(),
  };

  let pending = 0;
  let complete = 0;
  let notReachable = 0;
  let breached = 0;
  let escalated = 0;
  let awaitingBlockReview = 0;

  for (const row of rows) {
    const stage = byStage[row.track];
    stage.total += 1;

    if (row.isBlockStage) awaitingBlockReview += 1;
    if (isEscalated(row, now)) escalated += 1;

    if (row.status === "PENDING") {
      pending += 1;
      stage.pending += 1;
      if (isBreached(row, now)) {
        breached += 1;
        stage.breached += 1;
      }
    } else if (row.status === "COMPLETE") {
      complete += 1;
      stage.complete += 1;
    } else {
      notReachable += 1;
      stage.notReachable += 1;
    }
  }

  const total = rows.length;
  return {
    total,
    pending,
    complete,
    notReachable,
    breached,
    escalated,
    awaitingBlockReview,
    complianceRate: total === 0 ? 0 : Math.round((complete / total) * 100),
    byStage,
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
  if (role === "HRP_HELPDESK_BLOCK") return "HRP Helpdesk (block)";
  if (role === "HRP_HELPDESK_DISTRICT") return "HRP Helpdesk (district)";
  if (role === "BHM") return "BHM";
  if (role === "DHS") return "DHS";
  return role;
}

/** "15 Oct" style label for a due date. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
