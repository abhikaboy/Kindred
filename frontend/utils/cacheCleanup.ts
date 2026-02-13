import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('CacheCleanup');

/**
 * Utility to prevent AsyncStorage from growing unbounded
 * Cleans up old cache entries based on age and patterns
 */

interface CacheEntry {
    key: string;
    timestamp: number;
}

/**
 * Clean up old cache entries from AsyncStorage
 * @param maxAgeMs Maximum age in milliseconds (default: 7 days)
 * @param patterns Array of key patterns to clean (e.g., ['cache_', 'temp_'])
 */
export async function cleanupOldCaches(
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
    patterns: string[] = ['cache_', 'workspaces_cache_', 'temp_']
): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const now = Date.now();
        const keysToRemove: string[] = [];

        // Check each key that matches our patterns
        for (const key of allKeys) {
            const matchesPattern = patterns.some(pattern => key.includes(pattern));

            if (matchesPattern) {
                try {
                    const value = await AsyncStorage.getItem(key);
                    if (value) {
                        const parsed = JSON.parse(value);

                        // Check if it has a timestamp field
                        if (parsed.timestamp && typeof parsed.timestamp === 'number') {
                            const age = now - parsed.timestamp;

                            if (age > maxAgeMs) {
                                keysToRemove.push(key);
                            }
                        }
                    }
                } catch (error) {
                    // If we can't parse it, it might be corrupted - consider removing
                    logger.warn(`Failed to parse cache entry: ${key}`, error);
                }
            }
        }

        // Remove old entries
        if (keysToRemove.length > 0) {
            await AsyncStorage.multiRemove(keysToRemove);
            logger.info(`Cleaned up ${keysToRemove.length} old cache entries`);
        }
    } catch (error) {
        logger.error('Error cleaning up caches', error);
    }
}

/**
 * Get total size of AsyncStorage (approximate)
 * Returns number of keys and total character count
 */
export async function getStorageStats(): Promise<{ keyCount: number; totalSize: number }> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        let totalSize = 0;

        for (const key of allKeys) {
            const value = await AsyncStorage.getItem(key);
            if (value) {
                totalSize += key.length + value.length;
            }
        }

        return {
            keyCount: allKeys.length,
            totalSize,
        };
    } catch (error) {
        logger.error('Error getting storage stats', error);
        return { keyCount: 0, totalSize: 0 };
    }
}

/**
 * Limit the size of an array stored in AsyncStorage
 * @param key AsyncStorage key
 * @param maxSize Maximum array size
 * @param keepNewest If true, keeps newest items; if false, keeps oldest
 */
export async function limitArraySize<T>(
    key: string,
    maxSize: number,
    keepNewest: boolean = true
): Promise<void> {
    try {
        const value = await AsyncStorage.getItem(key);
        if (!value) return;

        const array = JSON.parse(value) as T[];

        if (array.length > maxSize) {
            const trimmed = keepNewest
                ? array.slice(-maxSize)
                : array.slice(0, maxSize);

            await AsyncStorage.setItem(key, JSON.stringify(trimmed));
            logger.info(`Trimmed ${key} from ${array.length} to ${maxSize} items`);
        }
    } catch (error) {
        logger.error(`Error limiting array size for ${key}`, error);
    }
}

/**
 * Remove all keys matching a pattern
 * @param pattern String pattern to match (e.g., 'temp_')
 */
export async function removeKeysMatching(pattern: string): Promise<number> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(key => key.includes(pattern));

        if (keysToRemove.length > 0) {
            await AsyncStorage.multiRemove(keysToRemove);
            logger.info(`Removed ${keysToRemove.length} keys matching pattern: ${pattern}`);
        }

        return keysToRemove.length;
    } catch (error) {
        logger.error(`Error removing keys matching ${pattern}`, error);
        return 0;
    }
}
