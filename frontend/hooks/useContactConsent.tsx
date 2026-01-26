import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTACT_CONSENT_KEY = '@kindred_contact_consent';

export interface ContactConsentState {
    hasConsent: boolean | null; // null = not asked yet, true = granted, false = denied
    consentTimestamp?: number;
}

/**
 * Hook to manage user consent for uploading contacts to server
 * This is required for App Store compliance - we must inform users
 * that their contacts will be uploaded and get explicit consent
 */
export function useContactConsent() {
    const [consentState, setConsentState] = useState<ContactConsentState>({
        hasConsent: null,
    });
    const [isLoading, setIsLoading] = useState(true);

    // Load consent state from storage on mount
    useEffect(() => {
        loadConsentState();
    }, []);

    const loadConsentState = async () => {
        try {
            const stored = await AsyncStorage.getItem(CONTACT_CONSENT_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as ContactConsentState;
                setConsentState(parsed);
            }
        } catch (error) {
            console.error('Error loading contact consent state:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const grantConsent = useCallback(async () => {
        const newState: ContactConsentState = {
            hasConsent: true,
            consentTimestamp: Date.now(),
        };
        try {
            await AsyncStorage.setItem(CONTACT_CONSENT_KEY, JSON.stringify(newState));
            setConsentState(newState);
        } catch (error) {
            console.error('Error saving contact consent:', error);
            throw error;
        }
    }, []);

    const denyConsent = useCallback(async () => {
        const newState: ContactConsentState = {
            hasConsent: false,
            consentTimestamp: Date.now(),
        };
        try {
            await AsyncStorage.setItem(CONTACT_CONSENT_KEY, JSON.stringify(newState));
            setConsentState(newState);
        } catch (error) {
            console.error('Error saving contact consent denial:', error);
            throw error;
        }
    }, []);

    const resetConsent = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(CONTACT_CONSENT_KEY);
            setConsentState({ hasConsent: null });
        } catch (error) {
            console.error('Error resetting contact consent:', error);
            throw error;
        }
    }, []);

    return {
        hasConsent: consentState.hasConsent,
        consentTimestamp: consentState.consentTimestamp,
        isLoading,
        grantConsent,
        denyConsent,
        resetConsent,
    };
}
