/**
 * Logging utility for conditional debug output
 * Only logs in development mode to reduce console noise in production
 */

// @ts-ignore - __DEV__ is a global constant defined by React Native
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

export const logger = {
    /**
     * Log informational messages (only in development)
     */
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Log warning messages (only in development)
     */
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    /**
     * Log error messages (always logged, even in production)
     */
    error: (...args: any[]) => {
        console.error(...args);
    },

    /**
     * Log debug messages (only in development)
     */
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    /**
     * Group logs together (only in development)
     */
    group: (label: string) => {
        if (isDev) {
            console.group(label);
        }
    },

    /**
     * End a log group (only in development)
     */
    groupEnd: () => {
        if (isDev) {
            console.groupEnd();
        }
    },

    /**
     * Log a table (only in development)
     */
    table: (data: any) => {
        if (isDev && console.table) {
            console.table(data);
        }
    },
};

export default logger;
