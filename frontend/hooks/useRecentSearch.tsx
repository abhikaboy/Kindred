import { useEffect, useState } from "react";
import asyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAsync } from "../hooks/useSafeAsync";

export interface RecentSearchItem {
    id: string;
    type: 'user' | 'blueprint' | 'text';
    display_name?: string;
    handle?: string;
    name?: string;
    profile_picture?: string;
    banner?: string;
    text?: string;
    timestamp?: number; // Add timestamp for better sorting
}

export function useRecentSearch(searchSet: string = "") {
    const [recents, setRecents] = useState<RecentSearchItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const MAX_RECENTS = 6;
    const safeAsync = useSafeAsync();

    useEffect(() => {
        const loadRecents = async () => {
            if (searchSet === "") {
                setRecents([]);
                return;
            }

            setIsLoading(true);
            const { result, error } = await safeAsync(async () => {
                const recents = await asyncStorage.getItem(searchSet);
                if (recents) {
                    const parsed = JSON.parse(recents);
                    
                    // Migrate old string-based recents to new format
                    if (parsed.length > 0 && typeof parsed[0] === 'string') {
                        return parsed.map((text: string) => ({
                            id: text,
                            type: 'text' as const,
                            text,
                            timestamp: Date.now()
                        }));
                    }
                    
                    return parsed;
                } else {
                    return [];
                }
            });

            if (error) {
                console.error("Error loading recents:", error);
                setIsLoading(false);
                return;
            }

            setRecents(result || []);
            setIsLoading(false);
        };

        loadRecents();
    }, [searchSet, safeAsync]);

    const appendSearch = async (search: RecentSearchItem | string) => {
        if (!searchSet || searchSet.trim() === "") {
            return;
        }
        
        // Convert string to RecentSearchItem for backwards compatibility
        let searchItem: RecentSearchItem;
        
        if (typeof search === 'string') {
            searchItem = { 
                id: search, 
                type: 'text', 
                text: search,
                timestamp: Date.now()
            };
        } else {
            // Ensure we have all the data we need
            searchItem = {
                ...search,
                timestamp: Date.now()
            };
        }
        
        // Validate the search item
        if (!searchItem.id) {
            return;
        }
        
        if (searchItem.type === 'text' && !searchItem.text?.trim()) {
            return;
        }
        
        // Remove any existing item with the same ID
        let filtered = recents.filter((item) => item.id !== searchItem.id);
        
        // Add to front and limit
        let newRecents = [searchItem, ...filtered].slice(0, MAX_RECENTS);
        
        // Save to storage
        await asyncStorage.setItem(searchSet, JSON.stringify(newRecents));
        setRecents(newRecents);
    };

    const deleteRecent = async (id: string) => {
        if (!searchSet || searchSet.trim() === "" || !id || id.trim() === "") {
            return;
        }
        
        const filtered = recents.filter((item) => item.id !== id);
        await asyncStorage.setItem(searchSet, JSON.stringify(filtered));
        setRecents(filtered);
    };

    const getRecents = () => {
        return recents;
    };

    return { getRecents, appendSearch, deleteRecent, isLoading };
}