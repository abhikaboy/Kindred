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
    text?: string; // For legacy text searches
}

export function useRecentSearch(searchSet: string = "") {
    // two functions, append recent and get recents
    const [recents, setRecents] = useState<RecentSearchItem[]>([]);
    const MAX_RECENTS = 6;
    const safeAsync = useSafeAsync();

    useEffect(() => {
        const loadRecents = async () => {
            if (searchSet === "") {
                setRecents(() => []);
                return;
            }

            const { result, error } = await safeAsync(async () => {
                const recents = await asyncStorage.getItem(searchSet);
                if (recents) {
                    console.log("found recent searches");
                    const parsed = JSON.parse(recents);
                    
                    // Migrate old string-based recents to new format
                    if (parsed.length > 0 && typeof parsed[0] === 'string') {
                        return parsed.map((text: string) => ({
                            id: text,
                            type: 'text' as const,
                            text
                        }));
                    }
                    
                    return parsed;
                } else {
                    console.log("didn't find search set");
                    return [];
                }
            });

            if (error) {
                console.error("Error loading recents:", error);
                return;
            }

            setRecents(result);
        };

        loadRecents();
    }, [searchSet]);

    const appendSearch = async (search: RecentSearchItem | string) => {
        if (searchSet.trim() === "") {
            return;
        }
        
        // Convert string to RecentSearchItem for backwards compatibility
        const searchItem: RecentSearchItem = typeof search === 'string' 
            ? { id: search, type: 'text', text: search }
            : search;
        
        if (!searchItem.id || (searchItem.type === 'text' && !searchItem.text?.trim())) {
            return;
        }
        
        let filtered = recents;
        // Remove duplicate by id
        filtered = filtered.filter((item) => item.id !== searchItem.id);
        
        let newRecents = [searchItem, ...filtered];
        newRecents = newRecents.slice(0, MAX_RECENTS);
        console.log(newRecents);
        asyncStorage.setItem(searchSet, JSON.stringify(newRecents));
        setRecents(newRecents);
    };

    const deleteRecent = async (id: string) => {
        if (searchSet.trim() === "" || id.trim() === "") {
            return;
        }
        let filtered = recents;
        filtered = filtered.filter((item) => item.id !== id);
        asyncStorage.setItem(searchSet, JSON.stringify(filtered));
        console.log(filtered);
        setRecents(filtered);
    };

    const getRecents = () => {
        return recents;
    };

    return { getRecents, appendSearch, deleteRecent };
}
