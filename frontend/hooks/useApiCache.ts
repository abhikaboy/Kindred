import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface UseApiCacheOptions {
    cacheKey: string;
    cacheDuration?: number; // in milliseconds, default 5 minutes
    enableCache?: boolean;
}

/**
 * Hook to cache API responses with timestamp-based expiration
 * @param options Configuration for caching behavior
 * @returns Object with cached data, loading state, and fetch function
 */
export function useApiCache<T>(options: UseApiCacheOptions) {
    const { cacheKey, cacheDuration = 5 * 60 * 1000, enableCache = true } = options;
    
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
    const isInitialMount = useRef(true);

    /**
     * Check if cached data is still valid
     */
    const isCacheValid = useCallback((): boolean => {
        if (!enableCache || !lastFetchTime) return false;
        const now = Date.now();
        return (now - lastFetchTime) < cacheDuration;
    }, [lastFetchTime, cacheDuration, enableCache]);

    /**
     * Load cached data from AsyncStorage
     */
    const loadFromCache = useCallback(async (): Promise<T | null> => {
        if (!enableCache) return null;
        
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (!cached) return null;

            const cacheEntry: CacheEntry<T> = JSON.parse(cached);
            const now = Date.now();
            
            // Check if cache is expired
            if ((now - cacheEntry.timestamp) > cacheDuration) {
                // Cache expired, remove it
                await AsyncStorage.removeItem(cacheKey);
                return null;
            }

            setLastFetchTime(cacheEntry.timestamp);
            return cacheEntry.data;
        } catch (error) {
            console.error(`Error loading cache for ${cacheKey}:`, error);
            return null;
        }
    }, [cacheKey, cacheDuration, enableCache]);

    /**
     * Save data to cache with current timestamp
     */
    const saveToCache = useCallback(async (data: T): Promise<void> => {
        if (!enableCache) return;
        
        try {
            const cacheEntry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
            };
            await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
            setLastFetchTime(cacheEntry.timestamp);
        } catch (error) {
            console.error(`Error saving cache for ${cacheKey}:`, error);
        }
    }, [cacheKey, enableCache]);

    /**
     * Fetch data with caching logic
     * @param fetchFn Function that fetches the data from API
     * @param forceRefresh If true, bypasses cache and fetches fresh data
     */
    const fetchWithCache = useCallback(async (
        fetchFn: () => Promise<T>,
        forceRefresh: boolean = false
    ): Promise<T> => {
        // If cache is valid and not forcing refresh, return cached data
        if (!forceRefresh && isCacheValid() && data) {
            console.log(`Using cached data for ${cacheKey}`);
            return data;
        }

        // Try to load from AsyncStorage if this is initial mount
        if (isInitialMount.current && !forceRefresh) {
            const cachedData = await loadFromCache();
            if (cachedData) {
                console.log(`Loaded from storage cache for ${cacheKey}`);
                setData(cachedData);
                isInitialMount.current = false;
                return cachedData;
            }
        }

        // Fetch fresh data
        setLoading(true);
        try {
            console.log(`Fetching fresh data for ${cacheKey}`);
            const freshData = await fetchFn();
            setData(freshData);
            await saveToCache(freshData);
            isInitialMount.current = false;
            return freshData;
        } catch (error) {
            console.error(`Error fetching data for ${cacheKey}:`, error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [cacheKey, data, isCacheValid, loadFromCache, saveToCache]);

    /**
     * Clear the cache for this key
     */
    const clearCache = useCallback(async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem(cacheKey);
            setData(null);
            setLastFetchTime(null);
            console.log(`Cleared cache for ${cacheKey}`);
        } catch (error) {
            console.error(`Error clearing cache for ${cacheKey}:`, error);
        }
    }, [cacheKey]);

    /**
     * Get time until cache expires (in milliseconds)
     */
    const getTimeUntilExpiry = useCallback((): number | null => {
        if (!lastFetchTime) return null;
        const elapsed = Date.now() - lastFetchTime;
        const remaining = cacheDuration - elapsed;
        return remaining > 0 ? remaining : 0;
    }, [lastFetchTime, cacheDuration]);

    return {
        data,
        loading,
        fetchWithCache,
        clearCache,
        isCacheValid: isCacheValid(),
        lastFetchTime,
        timeUntilExpiry: getTimeUntilExpiry(),
    };
}

