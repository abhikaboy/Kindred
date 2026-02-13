import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cleanupOldCaches, getStorageStats } from '@/utils/cacheCleanup';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CacheCleanup');

/**
 * Hook to automatically clean up old cache entries
 * Runs cleanup when app becomes active and periodically
 */
export function useCacheCleanup(options?: {
    maxAgeMs?: number;
    patterns?: string[];
    enableLogging?: boolean;
}) {
    const {
        maxAgeMs = 7 * 24 * 60 * 60 * 1000, // 7 days
        patterns = ['cache_', 'workspaces_cache_', 'temp_'],
        enableLogging = false,
    } = options || {};

    const lastCleanupRef = useRef<number>(0);
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Run cleanup once per day

    useEffect(() => {
        const runCleanup = async () => {
            const now = Date.now();
            const timeSinceLastCleanup = now - lastCleanupRef.current;

            // Only run if enough time has passed
            if (timeSinceLastCleanup < CLEANUP_INTERVAL) {
                return;
            }

            if (enableLogging) {
                const statsBefore = await getStorageStats();
                logger.info('Cache cleanup - Before:', statsBefore);
            }

            await cleanupOldCaches(maxAgeMs, patterns);
            lastCleanupRef.current = now;

            if (enableLogging) {
                const statsAfter = await getStorageStats();
                logger.info('Cache cleanup - After:', statsAfter);
            }
        };

        // Run cleanup on mount (but only if interval has passed)
        runCleanup();

        // Listen for app state changes
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                runCleanup();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [maxAgeMs, patterns, enableLogging]);
}
