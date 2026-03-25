import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

interface SpotlightState {
    homeSpotlight: boolean;
    menuSpotlight: boolean;
    workspaceSpotlight: boolean;
    taskSpotlight: boolean;
}

interface SpotlightContextType {
    spotlightState: SpotlightState;
    setSpotlightShown: (key: keyof SpotlightState) => void;
    skipAllSpotlights: () => void;
    resetSpotlights: () => void;
    isLoading: boolean;
}

const SpotlightContext = createContext<SpotlightContextType | undefined>(undefined);

const initialState: SpotlightState = {
    homeSpotlight: false,
    menuSpotlight: false,
    workspaceSpotlight: false,
    taskSpotlight: false,
};

const allDoneState: SpotlightState = {
    homeSpotlight: true,
    menuSpotlight: true,
    workspaceSpotlight: true,
    taskSpotlight: true,
};

export const SpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [spotlightState, setSpotlightState] = useState<SpotlightState>(initialState);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();
    const userId = user?._id;
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        let cancelled = false;

        const loadSpotlightState = async () => {
            if (!userId) {
                setIsLoading(false);
                return;
            }

            try {
                const key = `${userId}-spotlight`;
                const storedValue = await AsyncStorage.getItem(key);

                if (!cancelled && storedValue !== null) {
                    setSpotlightState(JSON.parse(storedValue));
                }
            } catch (error) {
                console.error('Error loading spotlight state:', error);
            } finally {
                if (!cancelled) {
                    isInitialLoadRef.current = false;
                    setIsLoading(false);
                }
            }
        };

        loadSpotlightState();
        return () => { cancelled = true; };
    }, [userId]);

    // Persist spotlight state whenever it changes (after initial load)
    useEffect(() => {
        if (!userId || isInitialLoadRef.current) return;

        AsyncStorage.setItem(`${userId}-spotlight`, JSON.stringify(spotlightState)).catch(
            error => console.error('Error saving spotlight state:', error)
        );
    }, [userId, spotlightState]);

    const setSpotlightShown = useCallback((key: keyof SpotlightState) => {
        if (!userId) return;
        setSpotlightState(prev => ({ ...prev, [key]: true }));
    }, [userId]);

    const skipAllSpotlights = useCallback(() => {
        if (!userId) return;
        setSpotlightState(allDoneState);
    }, [userId]);

    const resetSpotlights = useCallback(() => {
        if (!userId) return;
        setSpotlightState(initialState);
    }, [userId]);

    const value = useMemo(() => ({
        spotlightState,
        setSpotlightShown,
        skipAllSpotlights,
        resetSpotlights,
        isLoading,
    }), [spotlightState, setSpotlightShown, skipAllSpotlights, resetSpotlights, isLoading]);

    return (
        <SpotlightContext.Provider value={value}>
            {children}
        </SpotlightContext.Provider>
    );
};

export const useSpotlight = () => {
    const context = useContext(SpotlightContext);
    if (context === undefined) {
        throw new Error('useSpotlight must be used within a SpotlightProvider');
    }
    return context;
};
