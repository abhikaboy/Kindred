/**
 * Date to Local Aware Date
 */

/**
 * Formats a date to local date string
 * @param date - Date object, string, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in local timezone
 */
export const formatLocalDate = (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString(undefined, options);
};

/**
 * Formats a date to local time string
 * @param date - Date object, string, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted time string in local timezone
 */
export const formatLocalTime = (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString(undefined, options);
};

/**
 * Formats a date to both local date and time string
 * @param date - Date object, string, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date and time string in local timezone
 */
export const formatLocalDateTime = (date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString(undefined, options);
};

/**
 * Converts a date-only string (YYYY-MM-DD) to a Date object at local midnight.
 * This is important for calendar selections where the date is meant to be local.
 */
export const stringToLocalAwareDate = (date: string): Date => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
};

export const copyTime = (date: Date, time: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), 0, 0);
};

/** e.g. "July 6th" — month name + ordinal day */
export const formatOrdinalDate = (date: string | Date | number): string => {
    const d = date instanceof Date ? date : new Date(date);
    const day = d.getDate();
    const s = ["th", "st", "nd", "rd"];
    const v = day % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return `${d.toLocaleDateString(undefined, { month: "long" })} ${day}${suffix}`;
};

const humanizeMinutes = (m: number): string => {
    if (m % 1440 === 0) return `${m / 1440} day`;
    if (m % 60 === 0) return `${m / 60} hr`;
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} hr ${m % 60} min`;
};

type ReminderRel = {
    triggerTime: string;
    beforeStart?: boolean;
    afterStart?: boolean;
    beforeDeadline?: boolean;
    afterDeadline?: boolean;
};

/** Shorthand like "15 min before start" / "1 hr after deadline". null for absolute reminders. */
export const reminderRelativeLabel = (
    r: ReminderRel,
    anchors: { start?: string | Date | null; deadline?: string | Date | null }
): string | null => {
    let anchor: Date;
    let label: string;
    let before: boolean;
    if (r.beforeStart || r.afterStart) {
        if (!anchors.start) return null;
        anchor = new Date(anchors.start);
        label = "start";
        before = !!r.beforeStart;
    } else if (r.beforeDeadline || r.afterDeadline) {
        if (!anchors.deadline) return null;
        anchor = new Date(anchors.deadline);
        label = "deadline";
        before = !!r.beforeDeadline;
    } else {
        return null;
    }
    const minutes = Math.round(Math.abs(anchor.getTime() - new Date(r.triggerTime).getTime()) / 60000);
    if (minutes === 0) return `at ${label}`;
    return `${humanizeMinutes(minutes)} ${before ? "before" : "after"} ${label}`;
};

export const combineDateAndTime = (date: Date, time: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), 0, 0);
};
