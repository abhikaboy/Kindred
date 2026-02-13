/**
 * Custom Logger with configurable log levels
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('Debug message', { data });
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 *
 * Configuration:
 *   Set LOG_LEVEL in .env:
 *   - NONE: No logging
 *   - ERROR: Only errors
 *   - WARN: Warnings and errors
 *   - INFO: Info, warnings, and errors
 *   - DEBUG: All logs (default in development)
 */

export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
}

interface LoggerConfig {
    level: LogLevel;
    enableTimestamps: boolean;
    enableColors: boolean;
    enableStackTrace: boolean;
}

class Logger {
    private config: LoggerConfig;
    private readonly colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
        reset: '\x1b[0m',
    };

    constructor() {
        this.config = {
            level: this.getLogLevelFromEnv(),
            enableTimestamps: __DEV__,
            enableColors: __DEV__,
            enableStackTrace: __DEV__,
        };
    }

    private getLogLevelFromEnv(): LogLevel {
        // Check environment variable
        const envLevel = process.env.EXPO_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL;

        if (envLevel) {
            const level = envLevel.toUpperCase();
            switch (level) {
                case 'NONE':
                    return LogLevel.NONE;
                case 'ERROR':
                    return LogLevel.ERROR;
                case 'WARN':
                    return LogLevel.WARN;
                case 'INFO':
                    return LogLevel.INFO;
                case 'DEBUG':
                    return LogLevel.DEBUG;
            }
        }

        // Default: DEBUG in development, WARN in production
        return LogLevel.NONE;
    }

    /**
     * Set the log level programmatically
     */
    public setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Get current log level
     */
    public getLevel(): LogLevel {
        return this.config.level;
    }

    /**
     * Configure logger options
     */
    public configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    private shouldLog(level: LogLevel): boolean {
        return this.config.level >= level;
    }

    private formatMessage(
        level: string,
        message: string,
        data?: any,
        error?: Error
    ): string {
        let formatted = '';

        // Add timestamp
        if (this.config.enableTimestamps) {
            const timestamp = new Date().toISOString();
            formatted += `[${timestamp}] `;
        }

        // Add level with color
        if (this.config.enableColors) {
            const color = this.colors[level as keyof typeof this.colors] || '';
            formatted += `${color}[${level.toUpperCase()}]${this.colors.reset} `;
        } else {
            formatted += `[${level.toUpperCase()}] `;
        }

        // Add message
        formatted += message;

        return formatted;
    }

    private log(
        level: LogLevel,
        levelName: string,
        message: string,
        data?: any,
        error?: Error
    ): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(levelName, message, data, error);

        // Choose console method based on level
        const consoleMethod = level === LogLevel.ERROR ? console.error :
                            level === LogLevel.WARN ? console.warn :
                            console.log;

        // Log message
        consoleMethod(formattedMessage);

        // Log additional data if provided
        if (data !== undefined) {
            consoleMethod('Data:', data);
        }

        // Log error with stack trace if provided
        if (error) {
            consoleMethod('Error:', error);
            if (this.config.enableStackTrace && error.stack) {
                consoleMethod('Stack trace:', error.stack);
            }
        }
    }

    /**
     * Debug level logging - most verbose
     * Use for detailed debugging information
     */
    public debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, 'debug', message, data);
    }

    /**
     * Info level logging
     * Use for general informational messages
     */
    public info(message: string, data?: any): void {
        this.log(LogLevel.INFO, 'info', message, data);
    }

    /**
     * Warning level logging
     * Use for warning messages that don't prevent operation
     */
    public warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, 'warn', message, data);
    }

    /**
     * Error level logging
     * Use for error messages
     */
    public error(message: string, error?: Error | any, data?: any): void {
        this.log(LogLevel.ERROR, 'error', message, data, error);
    }

    /**
     * Group related logs together
     */
    public group(label: string): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.group(label);
        }
    }

    /**
     * End a log group
     */
    public groupEnd(): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.groupEnd();
        }
    }

    /**
     * Log with custom level
     */
    public custom(level: LogLevel, message: string, data?: any): void {
        const levelName = LogLevel[level].toLowerCase();
        this.log(level, levelName, message, data);
    }

    /**
     * Performance timing
     */
    public time(label: string): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.time(label);
        }
    }

    /**
     * End performance timing
     */
    public timeEnd(label: string): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.timeEnd(label);
        }
    }

    /**
     * Create a scoped logger with a prefix
     */
    public scope(prefix: string): ScopedLogger {
        return new ScopedLogger(this, prefix);
    }
}

/**
 * Scoped logger that adds a prefix to all messages
 */
class ScopedLogger {
    constructor(
        private logger: Logger,
        private prefix: string
    ) {}

    private formatMessage(message: string): string {
        return `[${this.prefix}] ${message}`;
    }

    public debug(message: string, data?: any): void {
        this.logger.debug(this.formatMessage(message), data);
    }

    public info(message: string, data?: any): void {
        this.logger.info(this.formatMessage(message), data);
    }

    public warn(message: string, data?: any): void {
        this.logger.warn(this.formatMessage(message), data);
    }

    public error(message: string, error?: Error | any, data?: any): void {
        this.logger.error(this.formatMessage(message), error, data);
    }

    public group(label: string): void {
        this.logger.group(this.formatMessage(label));
    }

    public groupEnd(): void {
        this.logger.groupEnd();
    }

    public time(label: string): void {
        this.logger.time(this.formatMessage(label));
    }

    public timeEnd(label: string): void {
        this.logger.timeEnd(this.formatMessage(label));
    }
}

// Export singleton instance
export const logger = new Logger();

// Export LogLevel enum for external use
export { LogLevel as LogLevelEnum };

// Convenience exports for scoped loggers
export const createLogger = (scope: string) => logger.scope(scope);
