import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const SpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [spotlightState, setSpotlightState] = useState<SpotlightState>(initialState);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    // Load spotlight state from AsyncStorage when user changes
    useEffect(() => {
        const loadSpotlightState = async () => {
            if (!user?._id) {
                setIsLoading(false);
                return;
            }

            try {
                const key = `${user._id}-spotlight`;
                const storedValue = await AsyncStorage.getItem(key);

                if (storedValue !== null) {
                    const parsedState = JSON.parse(storedValue);
                    setSpotlightState(parsedState);
                }
            } catch (error) {
                console.error('Error loading spotlight state:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSpotlightState();
    }, [user?._id]);

    const setSpotlightShown = async (key: keyof SpotlightState) => {
        if (!user?._id) return;

        try {
            const newState = {
                ...spotlightState,
                [key]: true,
            };
            setSpotlightState(newState);

            const storageKey = `${user._id}-spotlight`;
            await AsyncStorage.setItem(storageKey, JSON.stringify(newState));
        } catch (error) {
            console.error('Error saving spotlight state:', error);
        }
    };

    const resetSpotlights = async () => {
        if (!user?._id) return;

        try {
            setSpotlightState(initialState);

            const key = `${user._id}-spotlight`;
            await AsyncStorage.setItem(key, JSON.stringify(initialState));
        } catch (error) {
            console.error('Error resetting spotlight state:', error);
        }
    };

    return (
        <SpotlightContext.Provider
            value={{
                spotlightState,
                setSpotlightShown,
                resetSpotlights,
                isLoading,
            }}
        >
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

