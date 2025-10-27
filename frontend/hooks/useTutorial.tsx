import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TutorialState {
    hasSeenTutorial: boolean;
    isLoading: boolean;
}

export function useTutorial(userId: string | undefined) {
    const [state, setState] = useState<TutorialState>({
        hasSeenTutorial: false,
        isLoading: true,
    });

    // Load tutorial status from AsyncStorage
    useEffect(() => {
        const loadTutorialStatus = async () => {
            if (!userId) {
                setState({ hasSeenTutorial: false, isLoading: false });
                return;
            }

            try {
                const key = `${userId}-tutorial2`;
                const value = await AsyncStorage.getItem(key);
                
                // If value exists and is "true", user has seen the tutorial
                const hasSeenTutorial = value === 'true';
                
                setState({ hasSeenTutorial, isLoading: false });
            } catch (error) {
                console.error('Error loading tutorial status:', error);
                setState({ hasSeenTutorial: false, isLoading: false });
            }
        };

        loadTutorialStatus();
    }, [userId]);

    // Mark tutorial as seen
    const markTutorialAsSeen = useCallback(async () => {
        if (!userId) return;

        try {
            const key = `${userId}-tutorial`;
            // await AsyncStorage.setItem(key, 'true');
            // setState(prev => ({ ...prev, hasSeenTutorial: true }));
        } catch (error) {
            console.error('Error marking tutorial as seen:', error);
        }
    }, [userId]);

    // Reset tutorial (for testing or user request)
    const resetTutorial = useCallback(async () => {
        if (!userId) return;

        try {
            const key = `${userId}-tutorial`;
            await AsyncStorage.removeItem(key);
            setState(prev => ({ ...prev, hasSeenTutorial: false }));
        } catch (error) {
            console.error('Error resetting tutorial:', error);
        }
    }, [userId]);

    return {
        shouldShowTutorial: !state.hasSeenTutorial && !state.isLoading,
        isLoading: state.isLoading,
        markTutorialAsSeen,
        resetTutorial,
    };
}

