import { useEffect, useRef, useMemo } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanupOldCaches } from '@/utils/cacheCleanup';
import { getCachedUser } from '@/hooks/useAuth';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CacheCleanup');

const DEFAULT_PATTERNS = ['cache_', 'workspaces_cache_', 'temp_'];
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 10 * 1000;
// Deliberately doesn't match any cleanup pattern
export const LAST_CLEANUP_KEY = 'lastCacheCleanupAt';

export function useCacheCleanup(options?: {
    maxAgeMs?: number;
    patterns?: string[];
    enableLogging?: boolean;
}) {
    const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const patterns = options?.patterns ?? DEFAULT_PATTERNS;
    const enableLogging = options?.enableLogging ?? false;

    // In-memory mirror of the persisted last-run time; null until read from storage
    const lastCleanupRef = useRef<number | null>(null);
    const runningRef = useRef(false);

    const stablePatterns = useMemo(() => patterns, [patterns.join(',')]);

    useEffect(() => {
        const runCleanup = async () => {
            if (runningRef.current) return;
            runningRef.current = true;
            try {
                if (lastCleanupRef.current === null) {
                    const stored = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
                    lastCleanupRef.current = stored ? Number(stored) || 0 : 0;
                }
                const now = Date.now();
                if (now - lastCleanupRef.current < CLEANUP_INTERVAL) return;

                // The active user's caches are kept fresh by the app; skip them rather than parse them
                const userId = (await getCachedUser())?._id;
                const skipKeys = userId ? stablePatterns.map((pattern) => `${pattern}${userId}`) : [];
                if (userId) skipKeys.push(`kudos_cache_${userId}`);

                const removed = await cleanupOldCaches(maxAgeMs, stablePatterns, skipKeys);
                lastCleanupRef.current = now;
                await AsyncStorage.setItem(LAST_CLEANUP_KEY, String(now));

                if (enableLogging) {
                    logger.info('Cache cleanup complete', { removed });
                }
            } catch (error) {
                logger.error('Cache cleanup failed', error);
            } finally {
                runningRef.current = false;
            }
        };

        // Keep it off the startup path
        let interaction: { cancel: () => void } | null = null;
        const timer = setTimeout(() => {
            interaction = InteractionManager.runAfterInteractions(() => {
                runCleanup();
            });
        }, STARTUP_DELAY_MS);

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                runCleanup();
            }
        });

        return () => {
            clearTimeout(timer);
            interaction?.cancel();
            subscription.remove();
        };
    }, [maxAgeMs, stablePatterns, enableLogging]);
}
