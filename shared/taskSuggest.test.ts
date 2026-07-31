import { describe, expect, it } from "vitest";
import { parseRecurrence, parseSchedule, type ParsedRecurrence, type ParsedSchedule } from "./taskSuggest";

// Thursday, 30 July 2026, 09:00 local. Local-time construction keeps the
// expectations timezone-independent, since chrono resolves in local time too.
const NOW = new Date(2026, 6, 30, 9, 0, 0);
const iso = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

const NO_DAYS = [0, 0, 0, 0, 0, 0, 0];
const WEEKDAYS = [0, 1, 1, 1, 1, 1, 0];
const THURSDAY = [0, 0, 0, 0, 1, 0, 0];

const recur = (
  recurFrequency: ParsedRecurrence["recurFrequency"],
  every: number,
  daysOfWeek: number[],
  daysOfMonth?: number[],
): ParsedRecurrence => ({
  recurring: true,
  recurFrequency,
  recurDetails: { every, daysOfWeek, behavior: "ROLLING", ...(daysOfMonth ? { daysOfMonth } : {}) },
});

const schedule = (startDate: string | null, deadline: string | null = null): ParsedSchedule => ({
  startDate,
  startTime: startDate,
  deadline,
});

const SCHEDULE_CASES: [string, ParsedSchedule | null][] = [
  // Plain dates (chrono implies noon for a bare weekday, ref time-of-day for "tomorrow").
  ["meeting friday", schedule(iso(7, 31, 12))],
  ["call mom tomorrow", schedule(iso(7, 31, 9))],
  ["review notes next tuesday 3pm", schedule(iso(8, 4, 15))],
  // Time ranges -> start + deadline.
  ["lunch 12-1pm", schedule(iso(7, 30, 12), iso(7, 30, 13))],
  ["review notes 3pm-4:30pm friday", schedule(iso(7, 31, 15), iso(7, 31, 16, 30))],
  ["gym tomorrow 7-8am every weekday", schedule(iso(7, 31, 7), iso(7, 31, 8))],
  // Single instants -> start only.
  ["standup at 9am", schedule(iso(7, 30, 9))],
  // Recurrence words are cut before chrono sees them, so they never leak a date.
  ["gym every monday 7-8am", schedule(iso(7, 30, 7), iso(7, 30, 8))],
  ["gym every monday", null],
  ["every weekday", null],
  // Unrecognized.
  ["buy milk", null],
  ["", null],
];

const RECURRENCE_CASES: [string, ParsedRecurrence | null][] = [
  ["every day", recur("daily", 1, NO_DAYS)],
  ["daily", recur("daily", 1, NO_DAYS)],
  ["gym every day at 7am", recur("daily", 1, NO_DAYS)],
  ["every weekday", recur("weekly", 1, WEEKDAYS)],
  ["weekdays", recur("weekly", 1, WEEKDAYS)],
  ["gym tomorrow 7-8am every weekday", recur("weekly", 1, WEEKDAYS)],
  ["every week", recur("weekly", 1, THURSDAY)],
  ["weekly", recur("weekly", 1, THURSDAY)],
  ["every monday", recur("weekly", 1, [0, 1, 0, 0, 0, 0, 0])],
  ["every sunday", recur("weekly", 1, [1, 0, 0, 0, 0, 0, 0])],
  ["every saturday", recur("weekly", 1, [0, 0, 0, 0, 0, 0, 1])],
  ["every other tuesday", recur("weekly", 2, [0, 0, 1, 0, 0, 0, 0])],
  ["every 3 days", recur("daily", 3, NO_DAYS)],
  ["every 2 weeks", recur("weekly", 2, THURSDAY)],
  ["every 6 months", recur("monthly", 6, NO_DAYS, [30])],
  ["every month", recur("monthly", 1, NO_DAYS, [30])],
  ["monthly", recur("monthly", 1, NO_DAYS, [30])],
  ["rent every month", recur("monthly", 1, NO_DAYS, [30])],
  ["every year", recur("yearly", 1, NO_DAYS)],
  ["yearly", recur("yearly", 1, NO_DAYS)],
  ["annually", recur("yearly", 1, NO_DAYS)],
  ["every 2 years", recur("yearly", 2, NO_DAYS)],
  ["buy milk", null],
  ["gym tomorrow 7-8am", null],
  ["everything counts", null],
  ["", null],
];

describe("parseSchedule", () => {
  it.each(SCHEDULE_CASES)("%j", (text, expected) => {
    expect(parseSchedule(text, NOW)).toEqual(expected);
  });
});

describe("parseRecurrence", () => {
  it.each(RECURRENCE_CASES)("%j", (text, expected) => {
    expect(parseRecurrence(text, NOW)).toEqual(expected);
  });

  // Mirrors ValidateRecurDetails (backend/internal/handlers/task/util.go:58-103).
  it.each(RECURRENCE_CASES.filter(([, expected]) => expected !== null))("%j passes backend validation", (text) => {
    const { recurFrequency, recurDetails } = parseRecurrence(text, NOW)!;
    expect(recurDetails.every).toBeGreaterThanOrEqual(1);
    expect(recurDetails.behavior).toBe("ROLLING");
    expect(recurDetails.daysOfWeek).toHaveLength(7);
    expect(recurDetails.daysOfWeek.every((v) => v === 0 || v === 1)).toBe(true);
    if (recurFrequency === "weekly") expect(recurDetails.daysOfWeek.filter((v) => v === 1).length).toBeGreaterThan(0);
    if (recurFrequency === "monthly") expect(recurDetails.daysOfMonth?.length).toBeGreaterThan(0);
  });
});
