import { useEffect, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cleanupOldCaches, getStorageStats } from '@/utils/cacheCleanup';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CacheCleanup');

const DEFAULT_PATTERNS = ['cache_', 'workspaces_cache_', 'temp_'];
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useCacheCleanup(options?: {
    maxAgeMs?: number;
    patterns?: string[];
    enableLogging?: boolean;
}) {
    const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const patterns = options?.patterns ?? DEFAULT_PATTERNS;
    const enableLogging = options?.enableLogging ?? false;

    const lastCleanupRef = useRef<number>(0);
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

    const stablePatterns = useMemo(() => patterns, [patterns.join(',')]);

    useEffect(() => {
        const runCleanup = async () => {
            const now = Date.now();
            if (now - lastCleanupRef.current < CLEANUP_INTERVAL) return;

            if (enableLogging) {
                const statsBefore = await getStorageStats();
                logger.info('Cache cleanup - Before:', statsBefore);
            }

            await cleanupOldCaches(maxAgeMs, stablePatterns);
            lastCleanupRef.current = now;

            if (enableLogging) {
                const statsAfter = await getStorageStats();
                logger.info('Cache cleanup - After:', statsAfter);
            }
        };

        runCleanup();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                runCleanup();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [maxAgeMs, stablePatterns, enableLogging]);
}
