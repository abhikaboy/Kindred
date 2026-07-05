import {
    differenceInDays,
    format,
    formatDistanceStrict,
    isAfter,
    isBefore,
    isToday,
    isTomorrow,
    isValid,
    parseISO,
} from "date-fns";

export type TimeChipTone = "neutral" | "overdue";
export type TimeChipIcon = "clock" | "calendar";
export type TimeChipInfo = { label: string; tone: TimeChipTone; icon: TimeChipIcon };

type TimeChipTask = {
    startTime?: string;
    deadline?: string;
    startDate?: string;
    isPhantom?: boolean;
    nextGenerated?: string;
};

const UNITS: [RegExp, string][] = [
    [/ years?/, "y"],
    [/ months?/, "mo"],
    [/ weeks?/, "w"],
    [/ days?/, "d"],
    [/ hours?/, "h"],
    [/ minutes?/, "m"],
    [/ seconds?/, "s"],
];

export function abbreviateDistance(distance: string): string {
    let out = distance;
    for (const [re, abbr] of UNITS) out = out.replace(re, abbr);
    return out;
}

const distance = (date: Date, now: Date) => abbreviateDistance(formatDistanceStrict(date, now));

const safeParse = (iso: string): Date | null => {
    const d = parseISO(iso);
    return isValid(d) ? d : null;
};

function deadlineChip(deadline: Date, now: Date): TimeChipInfo {
    if (isAfter(now, deadline)) {
        return { label: `${distance(deadline, now)} overdue`, tone: "overdue", icon: "clock" };
    }
    return { label: `due in ${distance(deadline, now)}`, tone: "neutral", icon: "clock" };
}

// Ports TaskCard's dateDisplay priority order: phantom -> start+deadline -> deadline -> startDate.
export function getTimeChipInfo(
    task: TimeChipTask | undefined,
    detailed: boolean,
    now: Date = new Date()
): TimeChipInfo | null {
    if (!task) return null;

    if (task.isPhantom && task.nextGenerated) {
        const next = safeParse(task.nextGenerated);
        if (!next) return null;
        let label: string;
        if (isToday(next)) label = "today";
        else if (isTomorrow(next)) label = "tomorrow";
        else if (differenceInDays(next, now) <= 6) label = format(next, "EEEE");
        else label = format(next, "MMM d");
        return { label, tone: "neutral", icon: "calendar" };
    }

    if (!detailed) return null;

    if (task.startTime && task.deadline) {
        const start = safeParse(task.startTime);
        const deadline = safeParse(task.deadline);
        if (!start || !deadline) return null;
        if (isBefore(now, start)) {
            return { label: `starts in ${distance(start, now)}`, tone: "neutral", icon: "calendar" };
        }
        return deadlineChip(deadline, now);
    }

    if (task.deadline) {
        const deadline = safeParse(task.deadline);
        return deadline ? deadlineChip(deadline, now) : null;
    }

    if (task.startDate) {
        const start = safeParse(task.startDate);
        if (!start) return null;
        if (isToday(start)) return { label: "today", tone: "neutral", icon: "calendar" };
        if (isTomorrow(start)) return { label: "tomorrow", tone: "neutral", icon: "calendar" };
        if (isAfter(now, start)) return { label: `${distance(start, now)} ago`, tone: "neutral", icon: "calendar" };
        return { label: `in ${distance(start, now)}`, tone: "neutral", icon: "calendar" };
    }

    return null;
}
