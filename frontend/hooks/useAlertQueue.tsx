import { useState, useCallback } from 'react';
import { AlertButton } from '@/components/modals/CustomAlert';

interface AlertConfig {
    title: string;
    message: string;
    buttons: AlertButton[];
}

export function useAlertQueue() {
    const [queue, setQueue] = useState<AlertConfig[]>([]);
    const [currentAlert, setCurrentAlert] = useState<AlertConfig | null>(null);

    const showAlert = useCallback((config: AlertConfig) => {
        if (currentAlert === null) {
            // No alert showing, show immediately
            setCurrentAlert(config);
        } else {
            // Alert already showing, add to queue
            setQueue(prev => [...prev, config]);
        }
    }, [currentAlert]);

    const dismissCurrentAlert = useCallback(() => {
        setCurrentAlert(null);
        // Show next alert from queue if any
        setQueue(prev => {
            if (prev.length > 0) {
                const [next, ...rest] = prev;
                setTimeout(() => setCurrentAlert(next), 100);
                return rest;
            }
            return prev;
        });
    }, []);

    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentAlert(null);
    }, []);

    return {
        currentAlert,
        showAlert,
        dismissCurrentAlert,
        clearQueue,
        isVisible: currentAlert !== null,
    };
}
