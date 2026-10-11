// Quick "pick a day" choices for a Someday card. Pure, so tests can load it without native modules.
import { planWhenDate } from "@/utils/planWhen";

export type AssignKey = "tonight" | "tomorrow" | "weekend" | "nextWeek";

export const ASSIGN_OPTIONS: { key: AssignKey; label: string }[] = [
    { key: "tonight", label: "Tonight" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "weekend", label: "This weekend" },
    { key: "nextWeek", label: "Next week" },
];

/** Next Monday at 9 AM (a week out when today is Monday). */
function nextMonday(now: Date): Date {
    const d = new Date(now);
    const add = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + add);
    d.setHours(9, 0, 0, 0);
    return d;
}

export function assignDate(key: AssignKey, now: Date = new Date()): Date {
    return key === "nextWeek" ? nextMonday(now) : planWhenDate(key, now);
}
