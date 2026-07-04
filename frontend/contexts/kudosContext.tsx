import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { AppState } from "react-native";
import {
    getEncouragementsAPI,
    getSentEncouragementsAPI,
    markEncouragementsReadAPI,
    reactToEncouragementAPI,
} from "@/api/encouragement";
import {
    getCongratulationsAPI,
    getSentCongratulationsAPI,
    markCongratulationsReadAPI,
    reactToCongratulationAPI,
} from "@/api/congratulation";
import { createLogger } from "@/utils/logger";

const logger = createLogger('KudosContext');

interface KudosUserRef {
    name: string;
    picture: string;
    id: string;
}

export interface Encouragement {
    id: string;
    sender: KudosUserRef;
    message: string;
    scope: string;
    categoryName?: string;
    taskName?: string;
    timestamp: string;
    read: boolean;
    type?: string;
    reaction?: string | null;
    reactedAt?: string;
    /** Present only on sent kudos (the receiver's profile info). */
    receiverInfo?: KudosUserRef;
}

export interface Congratulation {
    id: string;
    sender: KudosUserRef;
    message: string;
    categoryName: string;
    taskName: string;
    timestamp: string;
    read: boolean;
    type?: string;
    reaction?: string | null;
    reactedAt?: string;
    /** Present only on sent kudos (the receiver's profile info). */
    receiverInfo?: KudosUserRef;
}

interface KudosContextType {
    encouragements: Encouragement[];
    congratulations: Congratulation[];
    sentEncouragements: Encouragement[];
    sentCongratulations: Congratulation[];
    unreadEncouragementCount: number;
    unreadCongratulationCount: number;
    totalEncouragementCount: number;
    totalCongratulationCount: number;
    loading: boolean;
    sentLoading: boolean;
    fetchKudosData: () => Promise<void>;
    fetchSentKudos: () => Promise<void>;
    markEncouragementsAsRead: () => Promise<void>;
    markCongratulationsAsRead: () => Promise<void>;
    reactToEncouragement: (id: string, emoji: string) => Promise<void>;
    reactToCongratulation: (id: string, emoji: string) => Promise<void>;
}

const KudosContext = createContext<KudosContextType | undefined>(undefined);

export const useKudos = () => {
    const context = useContext(KudosContext);
    if (!context) {
        throw new Error("useKudos must be used within a KudosProvider");
    }
    return context;
};

/** Like useKudos, but safe outside the provider (returns undefined). */
export const useKudosOptional = () => useContext(KudosContext);

interface KudosProviderProps {
    children: ReactNode;
}

export const KudosProvider: React.FC<KudosProviderProps> = ({ children }) => {
    const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
    const [congratulations, setCongratulations] = useState<Congratulation[]>([]);
    const [sentEncouragements, setSentEncouragements] = useState<Encouragement[]>([]);
    const [sentCongratulations, setSentCongratulations] = useState<Congratulation[]>([]);
    const [loading, setLoading] = useState(true);
    const [sentLoading, setSentLoading] = useState(false);
    const seenKudosIds = useRef<Set<string>>(new Set());

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

    const fetchKudosData = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) setLoading(true);

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

            [...sortedEncouragements, ...sortedCongratulations].forEach(k => seenKudosIds.current.add(k.id));
        } catch (error) {
            logger.error("Error fetching kudos data:", error);
        } finally {
            if (!options?.silent) setLoading(false);
        }
    }, []);

    const fetchSentKudos = useCallback(async () => {
        try {
            setSentLoading(true);

            const [sentEncouragementsData, sentCongratulationsData] = await Promise.all([
                getSentEncouragementsAPI().catch(() => []),
                getSentCongratulationsAPI().catch(() => []),
            ]);

            const byTimestampDesc = (a: { timestamp: string }, b: { timestamp: string }) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

            setSentEncouragements([...sentEncouragementsData].sort(byTimestampDesc) as Encouragement[]);
            setSentCongratulations([...sentCongratulationsData].sort(byTimestampDesc) as Congratulation[]);
        } catch (error) {
            logger.error("Error fetching sent kudos:", error);
        } finally {
            setSentLoading(false);
        }
    }, []);

    const reactToEncouragement = useCallback(async (id: string, emoji: string) => {
        // Optimistic toggle; reconciled with the server's reaction state below
        setEncouragements((prev) =>
            prev.map((e) => (e.id === id ? { ...e, reaction: e.reaction === emoji ? null : emoji } : e))
        );
        try {
            const { reaction } = await reactToEncouragementAPI(id, emoji);
            setEncouragements((prev) => prev.map((e) => (e.id === id ? { ...e, reaction } : e)));
        } catch (error) {
            logger.error("Error reacting to encouragement:", error);
            setEncouragements((prev) =>
                prev.map((e) => (e.id === id ? { ...e, reaction: e.reaction === emoji ? null : emoji } : e))
            );
        }
    }, []);

    const reactToCongratulation = useCallback(async (id: string, emoji: string) => {
        setCongratulations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, reaction: c.reaction === emoji ? null : emoji } : c))
        );
        try {
            const { reaction } = await reactToCongratulationAPI(id, emoji);
            setCongratulations((prev) => prev.map((c) => (c.id === id ? { ...c, reaction } : c)));
        } catch (error) {
            logger.error("Error reacting to congratulation:", error);
            setCongratulations((prev) =>
                prev.map((c) => (c.id === id ? { ...c, reaction: c.reaction === emoji ? null : emoji } : c))
            );
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

    // Refresh kudos when the app returns to the foreground so unread badges
    // stay current. Silent: no loading flip, so consumers never flash spinners.
    useEffect(() => {
        const sub = AppState.addEventListener("change", (status) => {
            if (status === "active") fetchKudosData({ silent: true });
        });
        return () => sub.remove();
    }, [fetchKudosData]);

    const value = useMemo<KudosContextType>(() => ({
        encouragements,
        congratulations,
        sentEncouragements,
        sentCongratulations,
        unreadEncouragementCount,
        unreadCongratulationCount,
        totalEncouragementCount,
        totalCongratulationCount,
        loading,
        sentLoading,
        fetchKudosData,
        fetchSentKudos,
        markEncouragementsAsRead,
        markCongratulationsAsRead,
        reactToEncouragement,
        reactToCongratulation,
    }), [
        encouragements,
        congratulations,
        sentEncouragements,
        sentCongratulations,
        unreadEncouragementCount,
        unreadCongratulationCount,
        totalEncouragementCount,
        totalCongratulationCount,
        loading,
        sentLoading,
        fetchKudosData,
        fetchSentKudos,
        markEncouragementsAsRead,
        markCongratulationsAsRead,
        reactToEncouragement,
        reactToCongratulation,
    ]);

    return <KudosContext.Provider value={value}>{children}</KudosContext.Provider>;
};
