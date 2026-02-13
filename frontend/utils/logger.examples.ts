/**
 * Logger Usage Examples
 *
 * This file demonstrates how to use the custom logger
 * throughout your application.
 */

import { logger, createLogger } from './logger';

// ============================================
// Example 1: Basic Logging
// ============================================

export function basicLoggingExample() {
    // Debug - most verbose, only in development
    logger.debug('User clicked button', { buttonId: 'submit' });

    // Info - general information
    logger.info('User logged in successfully');

    // Warning - something unexpected but not critical
    logger.warn('API response took longer than expected', { duration: 5000 });

    // Error - something went wrong
    logger.error('Failed to fetch user data', new Error('Network error'));
}

// ============================================
// Example 2: Scoped Logger
// ============================================

// Create a scoped logger for a specific module
const authLogger = createLogger('Auth');
const apiLogger = createLogger('API');
const cacheLogger = createLogger('Cache');

export function scopedLoggingExample() {
    // All logs will be prefixed with [Auth]
    authLogger.info('Starting authentication flow');
    authLogger.debug('Checking stored credentials');
    authLogger.error('Authentication failed', new Error('Invalid token'));

    // All logs will be prefixed with [API]
    apiLogger.info('Making API request', { endpoint: '/users' });
    apiLogger.warn('Retrying failed request');
}

// ============================================
// Example 3: Performance Timing
// ============================================

export async function performanceTimingExample() {
    logger.time('fetchUserData');

    try {
        // Your async operation
        await fetchUserData();

        logger.timeEnd('fetchUserData'); // Logs: fetchUserData: 234.56ms
    } catch (error) {
        logger.timeEnd('fetchUserData');
        logger.error('Failed to fetch user data', error);
    }
}

// ============================================
// Example 4: Grouped Logs
// ============================================

export function groupedLogsExample() {
    logger.group('User Registration Flow');
    logger.info('Step 1: Validating email');
    logger.info('Step 2: Creating user account');
    logger.info('Step 3: Sending verification email');
    logger.groupEnd();
}

// ============================================
// Example 5: Replacing console.log
// ============================================

// ❌ Old way (don't do this)
export function oldWayExample() {
    console.log('User data:', userData);
    console.log('Cache hit for key:', cacheKey);
    console.error('Error:', error);
}

// ✅ New way (do this)
export function newWayExample() {
    logger.debug('User data:', userData);
    logger.info('Cache hit for key:', cacheKey);
    logger.error('Error occurred', error);
}

// ============================================
// Example 6: Context-Specific Loggers
// ============================================

// In your contexts
export class TasksContextLogger {
    private logger = createLogger('TasksContext');

    logFetchStart() {
        this.logger.info('Fetching workspaces');
    }

    logFetchSuccess(count: number) {
        this.logger.info('Workspaces fetched successfully', { count });
    }

    logFetchError(error: Error) {
        this.logger.error('Failed to fetch workspaces', error);
    }

    logCacheHit() {
        this.logger.debug('Using cached workspaces');
    }
}

// ============================================
// Example 7: API Request Logging
// ============================================

const apiRequestLogger = createLogger('API');

export async function loggedApiRequest(endpoint: string, options: any) {
    const requestId = Math.random().toString(36).substr(2, 9);

    apiRequestLogger.group(`Request ${requestId}`);
    apiRequestLogger.info(`${options.method || 'GET'} ${endpoint}`);
    apiRequestLogger.debug('Request options', options);

    apiRequestLogger.time(`request-${requestId}`);

    try {
        const response = await fetch(endpoint, options);
        apiRequestLogger.timeEnd(`request-${requestId}`);

        if (!response.ok) {
            apiRequestLogger.warn(`Request failed with status ${response.status}`);
        } else {
            apiRequestLogger.info('Request successful');
        }

        apiRequestLogger.groupEnd();
        return response;
    } catch (error) {
        apiRequestLogger.timeEnd(`request-${requestId}`);
        apiRequestLogger.error('Request failed', error);
        apiRequestLogger.groupEnd();
        throw error;
    }
}

// ============================================
// Example 8: Component Lifecycle Logging
// ============================================

export function ComponentLifecycleLogger(componentName: string) {
    const componentLogger = createLogger(componentName);

    return {
        onMount: (props?: any) => {
            componentLogger.debug('Component mounted', props);
        },
        onUpdate: (reason?: string) => {
            componentLogger.debug('Component updated', { reason });
        },
        onUnmount: () => {
            componentLogger.debug('Component unmounted');
        },
        onError: (error: Error) => {
            componentLogger.error('Component error', error);
        },
    };
}

// Usage in component:
// const lifecycle = ComponentLifecycleLogger('FeedScreen');
// useEffect(() => {
//     lifecycle.onMount({ userId });
//     return () => lifecycle.onUnmount();
// }, []);

// ============================================
// Example 9: Conditional Logging
// ============================================

export function conditionalLoggingExample(user: any) {
    // Only log if user is admin (but respects log level)
    if (user.role === 'admin') {
        logger.debug('Admin action performed', { userId: user.id });
    }

    // Log different levels based on condition
    if (user.subscriptionExpired) {
        logger.warn('User subscription expired', { userId: user.id });
    } else {
        logger.info('User subscription active', { userId: user.id });
    }
}

// ============================================
// Example 10: Error Boundary Logging
// ============================================

export class ErrorBoundaryLogger {
    private logger = createLogger('ErrorBoundary');

    logError(error: Error, errorInfo: any) {
        this.logger.error('React error boundary caught error', error, {
            componentStack: errorInfo.componentStack,
        });
    }

    logRecovery() {
        this.logger.info('Error boundary recovered');
    }
}

// Dummy function for example
async function fetchUserData() {
    return Promise.resolve();
}

const userData = {};
const cacheKey = '';
const error = new Error();
