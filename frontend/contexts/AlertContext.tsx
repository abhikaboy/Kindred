import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect, useMemo } from 'react';
import QueuedAlert from '@/components/modals/QueuedAlert';
import { AlertButton } from '@/components/modals/CustomAlert';
import { logger } from '@/utils/logger';

export interface AlertConfig {
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

interface AlertContextType {
    showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const MAX_ALERT_QUEUE_SIZE = 10;

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertQueue, setAlertQueue] = useState<AlertConfig[]>([]);
    const [currentAlert, setCurrentAlert] = useState<AlertConfig | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
        };
    }, []);

    const processNextAlert = useCallback(() => {
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);

        setAlertQueue(prev => {
            if (prev.length > 0) {
                const [next, ...rest] = prev;
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
        setCurrentAlert(prev => {
            if (prev === null) {
                setIsVisible(true);
                return config;
            } else {
                setAlertQueue(q => {
                    const newQueue = [...q, config];
                    if (newQueue.length > MAX_ALERT_QUEUE_SIZE) {
                        logger.warn(`Alert queue exceeded ${MAX_ALERT_QUEUE_SIZE} items, dropping oldest alerts`);
                        return newQueue.slice(-MAX_ALERT_QUEUE_SIZE);
                    }
                    return newQueue;
                });
                return prev;
            }
        });
    }, []);

    const handleDismiss = useCallback(() => {
        setIsVisible(false);
        if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = setTimeout(() => {
            setCurrentAlert(null);
            processNextAlert();
        }, 400);
    }, [processNextAlert]);

    const wrappedButtons = useMemo(() => {
        return currentAlert?.buttons?.map(btn => ({
            ...btn,
            onPress: () => {
                if (btn.onPress) btn.onPress();
                if (buttonTimeoutRef.current) clearTimeout(buttonTimeoutRef.current);
                buttonTimeoutRef.current = setTimeout(() => {
                    handleDismiss();
                }, 50);
            }
        }));
    }, [currentAlert?.buttons, handleDismiss]);

    const value = useMemo(() => ({ showAlert }), [showAlert]);

    return (
        <AlertContext.Provider value={value}>
            {children}
            {currentAlert && (
                <QueuedAlert
                    visible={isVisible}
                    onDismiss={handleDismiss}
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
