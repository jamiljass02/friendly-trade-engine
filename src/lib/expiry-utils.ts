/**
 * Expiry calendar generation for Indian F&O markets
 * Weekly: every Thursday (or previous trading day if holiday)
 * Monthly: last Thursday of the month
 */

import { format, addDays, startOfMonth, endOfMonth, getDay, addMonths, isAfter, isBefore, startOfDay } from "date-fns";

/**
 * Get all Thursdays in a given month
 */
function getThursdaysInMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  const thursdays: Date[] = [];
  let current = start;
  while (!isAfter(current, end)) {
    if (getDay(current) === 4) {
      thursdays.push(current);
    }
    current = addDays(current, 1);
  }
  return thursdays;
}

/**
 * Get the last Thursday of a month (monthly expiry)
 */
function getLastThursday(year: number, month: number): Date {
  const thursdays = getThursdaysInMonth(year, month);
  return thursdays[thursdays.length - 1];
}

export interface ExpiryDate {
  date: Date;
  label: string; // e.g. "27 Feb", "6 Mar"
  fullLabel: string; // e.g. "27 Feb 2026"
  isWeekly: boolean;
  isMonthly: boolean;
  isCurrent: boolean; // nearest expiry
  isNext: boolean;
  isFar: boolean;
}

/**
 * Generate upcoming expiry dates for an instrument
 * @param weeklyExpiry - Whether the instrument has weekly expiries
 * @param count - Number of expiries to generate
 */
export function getUpcomingExpiries(weeklyExpiry: boolean, count: number = 12): ExpiryDate[] {
  const today = startOfDay(new Date());
  const expiries: ExpiryDate[] = [];

  if (weeklyExpiry) {
    // Generate weekly Thursdays for next 3 months
    let current = today;
    while (expiries.length < count) {
      if (getDay(current) === 4) {
        // Check if it's also a monthly expiry (last Thursday of month)
        const lastThurs = getLastThursday(current.getFullYear(), current.getMonth());
        const isMonthly = current.getTime() === lastThurs.getTime();

        if (!isBefore(current, today)) {
          expiries.push({
            date: current,
            label: format(current, "d MMM"),
            fullLabel: format(current, "d MMM yyyy"),
            isWeekly: !isMonthly,
            isMonthly,
            isCurrent: false,
            isNext: false,
            isFar: false,
          });
        }
      }
      current = addDays(current, 1);
    }
  } else {
    // Monthly expiries only
    let monthOffset = 0;
    while (expiries.length < count) {
      const targetDate = addMonths(today, monthOffset);
      const lastThurs = getLastThursday(targetDate.getFullYear(), targetDate.getMonth());
      if (!isBefore(lastThurs, today)) {
        expiries.push({
          date: lastThurs,
          label: format(lastThurs, "d MMM"),
          fullLabel: format(lastThurs, "d MMM yyyy"),
          isWeekly: false,
          isMonthly: true,
          isCurrent: false,
          isNext: false,
          isFar: false,
        });
      }
      monthOffset++;
    }
  }

  // Mark current/next/far
  if (expiries.length >= 1) expiries[0].isCurrent = true;
  if (expiries.length >= 2) expiries[1].isNext = true;
  if (expiries.length >= 3) expiries[2].isFar = true;

  return expiries;
}

/**
 * Calculate days to expiry from today
 */
export function getDaysToExpiry(expiryDate: Date): number {
  const today = startOfDay(new Date());
  const expiry = startOfDay(expiryDate);
  const diff = expiry.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format expiry for Shoonya trading symbol
 * e.g., NIFTY27FEB25C24000 or NIFTY26MAR25P23500
 */
export function formatExpiryForSymbol(date: Date): string {
  const day = format(date, "dd");
  const month = format(date, "MMM").toUpperCase();
  const year = format(date, "yy");
  return `${day}${month}${year}`;
}
