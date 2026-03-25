import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

interface FocusModeContextType {
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    toggleFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export const FocusModeProvider = ({ children }: { children: ReactNode }) => {
    const [focusMode, setFocusModeState] = useState(false);
    const { user } = useAuth();
    const userId = user?._id;

    useEffect(() => {
        let cancelled = false;

        const loadFocusMode = async () => {
            if (!userId) return;
            try {
                const key = `${userId}-focusmode`;
                const storedValue = await AsyncStorage.getItem(key);
                if (!cancelled && storedValue !== null) {
                    setFocusModeState(storedValue === 'true');
                }
            } catch (error) {
                console.error("Error loading focus mode:", error);
            }
        };

        loadFocusMode();
        return () => { cancelled = true; };
    }, [userId]);

    const toggleFocusMode = useCallback(() => {
        if (!userId) return;
        setFocusModeState(prev => {
            const newValue = !prev;
            AsyncStorage.setItem(`${userId}-focusmode`, newValue.toString()).catch(
                error => console.error("Error saving focus mode:", error)
            );
            return newValue;
        });
    }, [userId]);

    const setFocusMode = useCallback((value: boolean) => {
        if (!userId) return;
        setFocusModeState(value);
        AsyncStorage.setItem(`${userId}-focusmode`, value.toString()).catch(
            error => console.error("Error saving focus mode:", error)
        );
    }, [userId]);

    const value = useMemo(() => ({
        focusMode,
        setFocusMode,
        toggleFocusMode,
    }), [focusMode, setFocusMode, toggleFocusMode]);

    return (
        <FocusModeContext.Provider value={value}>
            {children}
        </FocusModeContext.Provider>
    );
};

export const useFocusMode = () => {
    const context = useContext(FocusModeContext);
    if (context === undefined) {
        throw new Error('useFocusMode must be used within a FocusModeProvider');
    }
    return context;
};
