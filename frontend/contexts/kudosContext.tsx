import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { getEncouragementsAPI, markEncouragementsReadAPI } from "@/api/encouragement";
import { getCongratulationsAPI, markCongratulationsReadAPI } from "@/api/congratulation";
import { createLogger } from "@/utils/logger";
import { EncouragementActivityFactory as EncouragementActivity } from "@/widgets/widgetUpdaters";

const logger = createLogger('KudosContext');

interface Encouragement {
    id: string;
    sender: {
        name: string;
        picture: string;
        id: string;
    };
    message: string;
    scope: string;
    categoryName?: string;
    taskName?: string;
    timestamp: string;
    read: boolean;
    type?: string;
}

interface Congratulation {
    id: string;
    sender: {
        name: string;
        picture: string;
        id: string;
    };
    message: string;
    categoryName: string;
    taskName: string;
    timestamp: string;
    read: boolean;
    type?: string;
}

interface KudosContextType {
    encouragements: Encouragement[];
    congratulations: Congratulation[];
    unreadEncouragementCount: number;
    unreadCongratulationCount: number;
    totalEncouragementCount: number;
    totalCongratulationCount: number;
    loading: boolean;
    fetchKudosData: () => Promise<void>;
    markEncouragementsAsRead: () => Promise<void>;
    markCongratulationsAsRead: () => Promise<void>;
}

const KudosContext = createContext<KudosContextType | undefined>(undefined);

export const useKudos = () => {
    const context = useContext(KudosContext);
    if (!context) {
        throw new Error("useKudos must be used within a KudosProvider");
    }
    return context;
};

interface KudosProviderProps {
    children: ReactNode;
}

export const KudosProvider: React.FC<KudosProviderProps> = ({ children }) => {
    const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
    const [congratulations, setCongratulations] = useState<Congratulation[]>([]);
    const [loading, setLoading] = useState(true);
    const seenKudosIds = useRef<Set<string>>(new Set());
    const liveActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const unreadEncouragementCount = useMemo(
        () => encouragements.filter((e) => !e.read).length,
        [encouragements]
    );
    const unreadCongratulationCount = useMemo(
        () => congratulations.filter((c) => !c.read).length,
        [congratulations]
    );
    const totalEncouragementCount = encouragements.length;
    const totalCongratulationCount = congratulations.length;

    useEffect(() => {
        return () => {
            if (liveActivityTimeoutRef.current) {
                clearTimeout(liveActivityTimeoutRef.current);
            }
        };
    }, []);

    const fetchKudosData = useCallback(async () => {
        try {
            setLoading(true);

            const [encouragementsData, congratulationsData] = await Promise.all([
                getEncouragementsAPI().catch(() => []),
                getCongratulationsAPI().catch(() => []),
            ]);

            const sortedEncouragements = [...encouragementsData].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            const sortedCongratulations = [...congratulationsData].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setEncouragements(sortedEncouragements);
            setCongratulations(sortedCongratulations);

            const newUnreadEncouragements = sortedEncouragements.filter(
                e => !e.read && !seenKudosIds.current.has(e.id)
            );
            const newUnreadCongratulations = sortedCongratulations.filter(
                c => !c.read && !seenKudosIds.current.has(c.id)
            );

            [...sortedEncouragements, ...sortedCongratulations].forEach(k => seenKudosIds.current.add(k.id));

            const latestEncouragement = newUnreadEncouragements[0];
            const latestCongratulation = newUnreadCongratulations[0];

            const latestItem = [latestEncouragement, latestCongratulation]
                .filter(Boolean)
                .sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime())[0];

            if (latestItem) {
                const isEncouragement = 'scope' in latestItem;
                const taskName = latestItem.taskName || '';
                const messageType = (latestItem as any).type === 'image' ? 'image' : 'message';
                const activity = EncouragementActivity.start({
                    senderName: latestItem.sender.name,
                    taskName,
                    message: latestItem.message || '',
                    kudosEarned: 5,
                    type: isEncouragement ? 'encouragement' : 'congratulation',
                    messageType: messageType as 'message' | 'image',
                });

                if (liveActivityTimeoutRef.current) {
                    clearTimeout(liveActivityTimeoutRef.current);
                }
                liveActivityTimeoutRef.current = setTimeout(() => {
                    activity.end('default');
                }, 30000);
            }
        } catch (error) {
            logger.error("Error fetching kudos data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const markEncouragementsAsRead = useCallback(async () => {
        const unreadIds = encouragements.filter((e) => !e.read).map((e) => e.id);
        if (unreadIds.length > 0) {
            try {
                await markEncouragementsReadAPI(unreadIds);
                setEncouragements((prev) => prev.map((enc) => ({ ...enc, read: true })));
            } catch (error) {
                console.error("Error marking encouragements as read:", error);
            }
        }
    }, [encouragements]);

    const markCongratulationsAsRead = useCallback(async () => {
        const unreadIds = congratulations.filter((c) => !c.read).map((c) => c.id);
        if (unreadIds.length > 0) {
            try {
                await markCongratulationsReadAPI(unreadIds);
                setCongratulations((prev) => prev.map((con) => ({ ...con, read: true })));
            } catch (error) {
                console.error("Error marking congratulations as read:", error);
            }
        }
    }, [congratulations]);

    useEffect(() => {
        fetchKudosData();
    }, [fetchKudosData]);

    const value = useMemo<KudosContextType>(() => ({
        encouragements,
        congratulations,
        unreadEncouragementCount,
        unreadCongratulationCount,
        totalEncouragementCount,
        totalCongratulationCount,
        loading,
        fetchKudosData,
        markEncouragementsAsRead,
        markCongratulationsAsRead,
    }), [
        encouragements,
        congratulations,
        unreadEncouragementCount,
        unreadCongratulationCount,
        totalEncouragementCount,
        totalCongratulationCount,
        loading,
        fetchKudosData,
        markEncouragementsAsRead,
        markCongratulationsAsRead,
    ]);

    return <KudosContext.Provider value={value}>{children}</KudosContext.Provider>;
};
