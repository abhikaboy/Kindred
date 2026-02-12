/**
 * Utility to parse and format API errors into user-friendly messages
 */

interface ApiError {
    detail?: string;
    errors?: Array<{
        message?: string;
        location?: string;
        value?: any;
    }>;
    message?: string;
    status?: number;
}

interface ParsedError {
    title: string;
    message: string;
    details?: string[];
}

/**
 * Parse an error object and extract user-friendly messages
 */
export function parseApiError(error: unknown, fallbackMessage: string = "An unexpected error occurred"): ParsedError {
    // Handle null/undefined
    if (!error) {
        return {
            title: "Error",
            message: fallbackMessage,
        };
    }

    // Handle string errors
    if (typeof error === "string") {
        return {
            title: "Error",
            message: error || fallbackMessage,
        };
    }

    // Handle Error objects
    if (error instanceof Error) {
        // Try to parse JSON from error message (some APIs return JSON strings)
        try {
            const parsed = JSON.parse(error.message);
            if (parsed && typeof parsed === "object") {
                return parseApiErrorObject(parsed, fallbackMessage);
            }
        } catch {
            // Not JSON, use the message as-is
        }

        return {
            title: "Error",
            message: error.message || fallbackMessage,
        };
    }

    // Handle API error objects
    if (typeof error === "object") {
        return parseApiErrorObject(error as ApiError, fallbackMessage);
    }

    return {
        title: "Error",
        message: fallbackMessage,
    };
}

/**
 * Parse an API error object
 */
function parseApiErrorObject(error: ApiError, fallbackMessage: string): ParsedError {
    const result: ParsedError = {
        title: "Error",
        message: fallbackMessage,
    };

    // Extract main message
    if (error.detail) {
        result.message = error.detail;
    } else if (error.message) {
        result.message = error.message;
    }

    // Add HTTP status context
    if (error.status) {
        result.title = getErrorTitle(error.status);
    }

    // Extract validation errors
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        result.details = error.errors
            .map((err) => {
                if (err.location && err.message) {
                    return `${err.location}: ${err.message}`;
                }
                return err.message || "Validation error";
            })
            .filter(Boolean);

        // If we have validation errors, update the main message
        if (result.details.length > 0) {
            result.message = "Please check the following:";
        }
    }

    return result;
}

/**
 * Get appropriate error title based on HTTP status code
 */
function getErrorTitle(status: number): string {
    if (status >= 400 && status < 500) {
        switch (status) {
            case 400:
                return "Invalid Request";
            case 401:
                return "Authentication Required";
            case 403:
                return "Access Denied";
            case 404:
                return "Not Found";
            case 429:
                return "Too Many Requests";
            default:
                return "Request Error";
        }
    }

    if (status >= 500) {
        return "Server Error";
    }

    return "Error";
}

/**
 * Format error for toast display (single line)
 */
export function formatErrorForToast(error: unknown, fallbackMessage: string = "An error occurred"): string {
    const parsed = parseApiError(error, fallbackMessage);

    if (parsed.details && parsed.details.length > 0) {
        return `${parsed.message} ${parsed.details[0]}`;
    }

    return parsed.message;
}

/**
 * Format error for alert display (with details)
 */
export function formatErrorForAlert(error: unknown, fallbackMessage: string = "An unexpected error occurred"): ParsedError {
    return parseApiError(error, fallbackMessage);
}

/**
 * Common error messages for specific scenarios
 */
export const ERROR_MESSAGES = {
    // Network
    NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
    TIMEOUT: "Request timed out. Please try again.",

    // Authentication
    AUTH_REQUIRED: "Please log in to continue.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
    INVALID_CREDENTIALS: "Invalid email or password.",

    // Calendar
    CALENDAR_CONNECT_FAILED: "Unable to connect your calendar. Please try again.",
    CALENDAR_SYNC_FAILED: "Failed to sync calendar events. Please try again later.",
    CALENDAR_DISCONNECT_FAILED: "Unable to disconnect calendar. Please try again.",
    CALENDAR_NOT_FOUND: "Calendar connection not found. Please reconnect.",

    // Tasks
    TASK_CREATE_FAILED: "Unable to create task. Please try again.",
    TASK_UPDATE_FAILED: "Unable to update task. Please try again.",
    TASK_DELETE_FAILED: "Unable to delete task. Please try again.",

    // Generic
    UNKNOWN_ERROR: "Something went wrong. Please try again.",
    VALIDATION_ERROR: "Please check your input and try again.",
} as const;
