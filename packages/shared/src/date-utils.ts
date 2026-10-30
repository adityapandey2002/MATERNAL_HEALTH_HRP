/**
 * Date utilities for HRP follow-up scheduling.
 *
 * PMSMA (Pradhan Mantri Surakshit Matritva Abhiyan) sessions are held on
 * fixed dates (9th, 15th, 21st) of each month at the PHC. If a PMSMA date
 * falls on a Sunday or a government holiday, the session moves to the next
 * working day.
 */

const PMSMA_DATES = [9, 15, 21] as const;

/**
 * Add N days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** True if the date is a Sunday. */
export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

/**
 * Check if a date is a government holiday.
 *
 * Integrates with the state/district holiday calendar. Returns false by
 * default — the calendar table must be populated for holiday detection.
 */
export function isHoliday(_date: Date): boolean {
  // TODO: Query government holiday calendar for state/district
  return false;
}

/**
 * Return the next working day (not Sunday, not a government holiday).
 */
export function getNextWorkingDay(date: Date): Date {
  let d = new Date(date);
  while (isSunday(d) || isHoliday(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/**
 * Compute the next PMSMA session date on or after `fromDate`.
 *
 * PMSMA dates are the 9th, 15th, and 21st of each month. If a date falls on
 * a Sunday or government holiday, it moves to the next working day.
 */
export function getNextPmsmaDate(fromDate: Date): Date {
  const year = fromDate.getUTCFullYear();
  const month = fromDate.getUTCMonth();

  // Check current month's PMSMA dates
  for (const day of PMSMA_DATES) {
    const candidate = new Date(Date.UTC(year, month, day));
    if (candidate >= fromDate) {
      return getNextWorkingDay(candidate);
    }
  }

  // Check next month's PMSMA dates
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (const day of PMSMA_DATES) {
    const candidate = new Date(Date.UTC(nextYear, nextMonth, day));
    return getNextWorkingDay(candidate);
  }
  // Should never reach here (PMSMA_DATES is non-empty)
  return getNextWorkingDay(new Date(Date.UTC(nextYear, nextMonth, PMSMA_DATES[0])));
}

/**
 * Compute the next VHSND (Village Health, Sanitation, and Nutrition Day).
 * VHSND is a monthly village-level event conducted by the ANM. The exact
 * date is determined by the local ANM schedule; this returns a reasonable
 * approximation (next month, same week) until the ANM schedule table is
 * integrated.
 */
export function getNextVhsndDate(_village: string, fromDate: Date): Date {
  // TODO: Integrate with ANM VHSND schedule table
  return addDays(fromDate, 30);
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
