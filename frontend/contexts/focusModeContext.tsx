import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

interface FocusModeContextType {
    focusMode: boolean;
    setFocusMode: (value: boolean) => void;
    toggleFocusMode: () => Promise<void>;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

export const FocusModeProvider = ({ children }: { children: ReactNode }) => {
    const [focusMode, setFocusModeState] = useState(false);
    const { user } = useAuth();

    // Load focus mode state from AsyncStorage
    useEffect(() => {
        const loadFocusMode = async () => {
            if (!user?._id) return;
            
            try {
                const key = `${user._id}-focusmode`;
                const storedValue = await AsyncStorage.getItem(key);
                
                if (storedValue !== null) {
                    setFocusModeState(storedValue === 'true');
                }
            } catch (error) {
                console.error("Error loading focus mode:", error);
            }
        };

        loadFocusMode();
    }, [user?._id]);

    // Toggle focus mode and save to AsyncStorage
    const toggleFocusMode = async () => {
        if (!user?._id) return;
        
        try {
            const newValue = !focusMode;
            setFocusModeState(newValue);
            
            const key = `${user._id}-focusmode`;
            await AsyncStorage.setItem(key, newValue.toString());
        } catch (error) {
            console.error("Error saving focus mode:", error);
        }
    };

    const setFocusMode = async (value: boolean) => {
        if (!user?._id) return;
        
        try {
            setFocusModeState(value);
            const key = `${user._id}-focusmode`;
            await AsyncStorage.setItem(key, value.toString());
        } catch (error) {
            console.error("Error saving focus mode:", error);
        }
    };

    return (
        <FocusModeContext.Provider value={{ focusMode, setFocusMode, toggleFocusMode }}>
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

