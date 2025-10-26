import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserExtendedReferenceWithPhone } from '@/api/profile';

export interface MatchedContact {
    user: UserExtendedReferenceWithPhone;
    contactName: string;
}

const STORAGE_KEY = '@kindred_matched_contacts';

export function useMatchedContacts() {
    const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load matched contacts from storage on mount
    useEffect(() => {
        loadMatchedContacts();
    }, []);

    const loadMatchedContacts = useCallback(async () => {
        try {
            setIsLoading(true);
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setMatchedContacts(parsed);
            }
        } catch (error) {
            console.error('Error loading matched contacts:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveMatchedContacts = useCallback(async (contacts: MatchedContact[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
            setMatchedContacts(contacts);
        } catch (error) {
            console.error('Error saving matched contacts:', error);
        }
    }, []);

    const addMatchedContacts = useCallback(async (newContacts: MatchedContact[]) => {
        try {
            // Merge with existing, avoiding duplicates based on user ID
            const existingIds = new Set(matchedContacts.map(c => c.user._id));
            const uniqueNew = newContacts.filter(c => !existingIds.has(c.user._id));
            const updated = [...matchedContacts, ...uniqueNew];
            
            await saveMatchedContacts(updated);
        } catch (error) {
            console.error('Error adding matched contacts:', error);
        }
    }, [matchedContacts, saveMatchedContacts]);

    const clearMatchedContacts = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setMatchedContacts([]);
        } catch (error) {
            console.error('Error clearing matched contacts:', error);
        }
    }, []);

    const removeMatchedContact = useCallback(async (userId: string) => {
        try {
            const updated = matchedContacts.filter(c => c.user._id !== userId);
            await saveMatchedContacts(updated);
        } catch (error) {
            console.error('Error removing matched contact:', error);
        }
    }, [matchedContacts, saveMatchedContacts]);

    return {
        matchedContacts,
        isLoading,
        addMatchedContacts,
        clearMatchedContacts,
        removeMatchedContact,
        refreshMatchedContacts: loadMatchedContacts,
    };
}

