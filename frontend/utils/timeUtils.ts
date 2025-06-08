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

export const combineDateAndTime = (date: Date, time: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), 0, 0);
};
