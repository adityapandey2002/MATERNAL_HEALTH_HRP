/**
 * Date utilities for the repeating 15-day HRP follow-up cycle.
 */

/**
 * Add N days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Result of automated follow-up scheduling.
 *
 * Matru Suraksha uses one repeating window: 15 days. A referred HRP starts
 * with the block helpdesk; everyone else starts with the registering field
 * worker. Completion starts the next 15-day window.
 */
export interface FollowUpScheduleResult {
  track: "BLOCK_15_DAY" | "FIELD_15_DAY";
  scheduledDate: Date;
  windowDays: number;
}

/** The next 15-day follow-up date, measured from `fromDate`. */
export function nextHrpFollowUpDate(fromDate: Date = new Date()): Date {
  return addDays(fromDate, 15);
}

/**
 * Automatically schedule the first follow-up for an HRP-identified patient.
 *
 * Referred women are the block helpdesk's responsibility for the first window;
 * non-referred women stay with the registering field worker.
 */
export function scheduleFollowUp(
  patient: { referred?: boolean | null },
  identifiedDate: Date = new Date()
): FollowUpScheduleResult {
  return {
    track: patient.referred ? "BLOCK_15_DAY" : "FIELD_15_DAY",
    scheduledDate: nextHrpFollowUpDate(identifiedDate),
    windowDays: 15,
  };
}
