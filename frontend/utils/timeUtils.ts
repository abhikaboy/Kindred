/**
 * Date to Local Aware Date
 */

export const stringToLocalAwareDate = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const localDate = new Date();
    localDate.setFullYear(year, month - 1, day);
    localDate.setHours(0, 0, 0, 0);
    return localDate;
};

/**
 * Converts a UTC time to the user's local timezone
 * @param utcTime - UTC time as a string, Date object, or timestamp
 * @returns Date object in local timezone
 */
export const convertUTCToLocal = (utcTime: string | Date | number): Date => {
    console.log("convertUTCToLocal input:", utcTime, "type:", typeof utcTime);
    if (!utcTime) {
        return new Date();
    }

    // Convert to Date object if it's not already
    let date: Date;
    if (utcTime instanceof Date) {
        console.log("Input is already a Date object");
        date = utcTime;
    } else if (typeof utcTime === "string") {
        // Go's time.Time serializes to RFC3339 format which JavaScript Date handles correctly
        // Don't add 'Z' automatically - let JavaScript handle the parsing
        console.log("Converting string to Date, original string:", utcTime);
        date = new Date(utcTime);
    } else {
        console.log("Converting number to Date");
        date = new Date(utcTime);
    }

    console.log("Final converted date:", date);
    console.log("Date in local timezone:", date.toString());
    console.log("Date in UTC:", date.toUTCString());
    // Return the date (JavaScript Date automatically handles timezone conversion)
    return date;
};

/**
 * Formats a date to local date string
 * @param utcTime - UTC time as a string, Date object, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in local timezone
 */
export const formatLocalDate = (utcTime: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const localDate = convertUTCToLocal(utcTime);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...options,
    };
    return localDate.toLocaleDateString(undefined, defaultOptions);
};

/**
 * Formats a date to local time string
 * @param utcTime - UTC time as a string, Date object, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted time string in local timezone
 */
export const formatLocalTime = (utcTime: Date, options?: Intl.DateTimeFormatOptions): string => {
    console.log("formatLocalTime input:", utcTime, "type:", typeof utcTime);
    const localDate = convertUTCToLocal(utcTime);
    console.log("convertUTCToLocal output:", localDate);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        ...options,
    };
    const result = localDate.toLocaleTimeString(undefined, defaultOptions);
    console.log("formatLocalTime result:", result);
    return result;
};

/**
 * Formats a date to both local date and time string
 * @param utcTime - UTC time as a string, Date object, or timestamp
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date and time string in local timezone
 */
export const formatLocalDateTime = (utcTime: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const localDate = convertUTCToLocal(utcTime);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
    };
    return localDate.toLocaleString(undefined, defaultOptions);
};
