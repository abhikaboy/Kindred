import { parse } from "chrono-node";

export type ParsedSchedule = {
  startDate: string | null; // ISO
  startTime: string | null; // ISO, same value as startDate
  deadline: string | null; // ISO
};

export type ParsedRecurrence = {
  recurring: true;
  recurFrequency: "daily" | "weekly" | "monthly" | "yearly";
  recurDetails: { every: number; daysOfWeek: number[]; behavior: "ROLLING"; daysOfMonth?: number[] };
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NO_DAYS = [0, 0, 0, 0, 0, 0, 0];
const WEEKDAYS = [0, 1, 1, 1, 1, 1, 0]; // Sunday-first, Mon-Fri set

// Sunday-first 0/1 mask with a single day set, as ValidateRecurDetails expects.
const mask = (dayIndex: number) => NO_DAYS.map((_, i) => (i === dayIndex ? 1 : 0));

function build(
  recurFrequency: ParsedRecurrence["recurFrequency"],
  every: number,
  daysOfWeek: number[],
  daysOfMonth?: number[],
): ParsedRecurrence {
  const recurDetails: ParsedRecurrence["recurDetails"] = { every, daysOfWeek, behavior: "ROLLING" };
  if (daysOfMonth) recurDetails.daysOfMonth = daysOfMonth;
  return { recurring: true, recurFrequency, recurDetails };
}

const DAYS_ALT = DAY_NAMES.join("|");

// ponytail: narrow recurrence grammar; upgrade to rrule parsing if users hit the wall
function matchRecurrence(text: string, now: Date): { recurrence: ParsedRecurrence; match: string } | null {
  let m: RegExpExecArray | null;

  if ((m = /\b(?:every\s*day|daily)\b/i.exec(text))) return { recurrence: build("daily", 1, [...NO_DAYS]), match: m[0] };

  if ((m = /\b(?:every\s+weekdays?|weekdays)\b/i.exec(text)))
    return { recurrence: build("weekly", 1, [...WEEKDAYS]), match: m[0] };

  if ((m = new RegExp(`\\bevery\\s+other\\s+(${DAYS_ALT})s?\\b`, "i").exec(text)))
    return { recurrence: build("weekly", 2, mask(DAY_NAMES.indexOf(m[1].toLowerCase()))), match: m[0] };

  if ((m = new RegExp(`\\bevery\\s+(${DAYS_ALT})s?\\b`, "i").exec(text)))
    return { recurrence: build("weekly", 1, mask(DAY_NAMES.indexOf(m[1].toLowerCase()))), match: m[0] };

  if ((m = /\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i.exec(text))) {
    const every = Number(m[1]);
    if (every < 1) return null;
    const unit = m[2].toLowerCase();
    if (unit === "day") return { recurrence: build("daily", every, [...NO_DAYS]), match: m[0] };
    if (unit === "week") return { recurrence: build("weekly", every, mask(now.getDay())), match: m[0] };
    if (unit === "year") return { recurrence: build("yearly", every, [...NO_DAYS]), match: m[0] };
    // Monthly needs daysOfMonth to pass backend validation; anchor on today, as mobile does.
    return { recurrence: build("monthly", every, [...NO_DAYS], [now.getDate()]), match: m[0] };
  }

  // Weekly with no named day still needs one day set, so anchor on today.
  if ((m = /\b(?:every\s+week|weekly)\b/i.exec(text)))
    return { recurrence: build("weekly", 1, mask(now.getDay())), match: m[0] };

  if ((m = /\b(?:every\s+month|monthly)\b/i.exec(text)))
    return { recurrence: build("monthly", 1, [...NO_DAYS], [now.getDate()]), match: m[0] };

  if ((m = /\b(?:every\s+year|yearly|annually)\b/i.exec(text)))
    return { recurrence: build("yearly", 1, [...NO_DAYS]), match: m[0] };

  return null;
}

export function parseSchedule(text: string, now: Date): ParsedSchedule | null {
  // Recurrence words parse as dates on their own ("every monday" -> last Monday), so cut them first.
  const recur = matchRecurrence(text, now);
  const [result] = parse(recur ? text.replace(recur.match, " ") : text, now);
  if (!result) return null;

  const start = result.start.date().toISOString();
  return { startDate: start, startTime: start, deadline: result.end ? result.end.date().toISOString() : null };
}

export function parseRecurrence(text: string, now: Date): ParsedRecurrence | null {
  return matchRecurrence(text, now)?.recurrence ?? null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_MASK = "0111110";

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function repeatLabel({ recurFrequency, recurDetails }: ParsedRecurrence): string {
  const { every, daysOfWeek } = recurDetails;
  if (recurFrequency === "weekly") {
    if (daysOfWeek.join("") === WEEKDAY_MASK) return "Weekdays";
    const named = daysOfWeek.map((v, i) => (v ? DAY_LABELS[i] : null)).filter(Boolean);
    if (named.length > 0) return every > 1 ? `Every ${every} weeks on ${named.join(", ")}` : `Every ${named.join(", ")}`;
  }
  const unit = recurFrequency === "daily" ? "day" : recurFrequency === "monthly" ? "month" : "year";
  return every > 1 ? `Every ${every} ${unit}s` : `Every ${unit}`;
}

// One human line for what was detected, shared so both apps read identically.
export function describeSchedule(schedule: ParsedSchedule | null, recurrence: ParsedRecurrence | null): string {
  const parts: string[] = [];
  if (schedule?.startDate) {
    parts.push(fmtDay(schedule.startDate));
    parts.push(
      schedule.deadline
        ? `${fmtTime(schedule.startDate)} to ${fmtTime(schedule.deadline)}`
        : fmtTime(schedule.startDate),
    );
  } else if (schedule?.deadline) {
    parts.push(`Due ${fmtDay(schedule.deadline)}`, fmtTime(schedule.deadline));
  }
  if (recurrence) parts.push(repeatLabel(recurrence));
  return parts.join(" · ");
}
