import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import QueuedAlert from '@/components/modals/QueuedAlert';
import { AlertButton } from '@/components/modals/CustomAlert';

export interface AlertConfig {
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

interface AlertContextType {
    showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertQueue, setAlertQueue] = useState<AlertConfig[]>([]);
    const [currentAlert, setCurrentAlert] = useState<AlertConfig | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const processNextAlert = useCallback(() => {
        // Clear any pending processing
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
        }
        
        setAlertQueue(prev => {
            if (prev.length > 0) {
                const [next, ...rest] = prev;
                
                // Delay to ensure previous alert is fully dismissed
                processingTimeoutRef.current = setTimeout(() => {
                    setCurrentAlert(next);
                    setIsVisible(true);
                }, 400);
                
                return rest;
            }
            return prev;
        });
    }, []);

    const showAlert = useCallback((config: AlertConfig) => {
        // Use functional updates to avoid stale closure issues
        setCurrentAlert(prev => {
            if (prev === null) {
                // No alert showing, show this one immediately
                setIsVisible(true);
                return config;
            } else {
                // Alert already showing, add to queue
                setAlertQueue(q => [...q, config]);
                return prev;
            }
        });
    }, []);

    const handleDismiss = useCallback(() => {
        setIsVisible(false);
        
        // Wait for dismiss animation, then clear and process queue
        setTimeout(() => {
            setCurrentAlert(null);
            processNextAlert();
        }, 400);
    }, [processNextAlert]);

    // Wrap buttons to handle dismissal intelligently
    const wrappedButtons = currentAlert?.buttons?.map(btn => ({
        ...btn,
        onPress: () => {
            // Call the original handler first
            if (btn.onPress) {
                btn.onPress();
            }
            
            // Always dismiss - the queue will handle showing the next alert
            // Use a small delay to ensure any showAlert() calls in the handler complete first
            setTimeout(() => {
                handleDismiss();
            }, 50);
        }
    }));

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            {currentAlert && (
                <QueuedAlert
                    visible={isVisible}
                    onDismiss={handleDismiss} // Allow manual dismissal (swipe/backdrop tap)
                    title={currentAlert.title}
                    message={currentAlert.message}
                    buttons={wrappedButtons}
                />
            )}
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within AlertProvider');
    }
    return context;
}
