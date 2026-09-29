// Pure, so tests can load it without native modules.
import type { PlanWhen } from "@/hooks/planSheetStore";

export type PlanWhenKey = PlanWhen | "picked";

const at = (base: Date, days: number, hours: number, minutes = 0) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d;
};

/** An hour from now, rounded up to the next quarter hour so it reads like a picked time. */
const soon = (now: Date) => {
    const d = new Date(now.getTime() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
};

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Maps a when choice to a start time. Tonight is 8 PM (or an hour out once the
 * evening has started), tomorrow is 9 AM, and this weekend is Saturday 10 AM
 * (Sunday once Saturday morning has passed). "picked" uses the picked Date.
 */
export function planWhenDate(key: PlanWhenKey, now: Date = new Date(), picked?: Date): Date {
    switch (key) {
        case "tonight":
            return minutesOfDay(now) < 19 * 60 + 30 ? at(now, 0, 20) : soon(now);
        case "tomorrow":
            return at(now, 1, 9);
        case "weekend": {
            const day = now.getDay();
            const beforeTen = minutesOfDay(now) < 10 * 60;
            if (day === 6) return beforeTen ? at(now, 0, 10) : at(now, 1, 10);
            if (day === 0) return beforeTen ? at(now, 0, 10) : soon(now);
            return at(now, 6 - day, 10);
        }
        case "picked":
            return picked ? new Date(picked) : soon(now);
    }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayDiff = (a: Date, b: Date) => {
    const x = new Date(a);
    x.setHours(0, 0, 0, 0);
    const y = new Date(b);
    y.setHours(0, 0, 0, 0);
    return Math.round((y.getTime() - x.getTime()) / 86400000);
};

export function formatClock(d: Date): string {
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes();
    return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** "Today", "Tomorrow", or the weekday name, for "<Day>'s already full". */
export function planDayLabel(date: Date, now: Date = new Date()): string {
    const diff = dayDiff(now, date);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return WEEKDAYS[date.getDay()];
}

/** Lowercase phrase for "Planned for <phrase>.": tonight, tomorrow, this weekend, Thursday at 7 PM. */
export function planWhenPhrase(key: PlanWhenKey, date: Date, now: Date = new Date()): string {
    if (key === "tonight") return "tonight";
    if (key === "tomorrow") return "tomorrow";
    if (key === "weekend") return "this weekend";
    const diff = dayDiff(now, date);
    const day = diff === 0 ? "today" : diff === 1 ? "tomorrow" : WEEKDAYS[date.getDay()];
    return `${day} at ${formatClock(date)}`;
}

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
