import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getEncouragementsAPI, markEncouragementsReadAPI } from "@/api/encouragement";
import { getCongratulationsAPI, markCongratulationsReadAPI } from "@/api/congratulation";
import { createLogger } from "@/utils/logger";
const logger = createLogger('KudosContext');

interface Encouragement {
    id: string;
    sender: {
        name: string;
        picture: string;
        id: string;
    };
    message: string;
    scope: string; // "task" or "profile"
    categoryName?: string; // Optional - only present for task-scoped encouragements
    taskName?: string; // Optional - only present for task-scoped encouragements
    timestamp: string;
    read: boolean;
    type?: string; // "message" or "image" (optional for backwards compatibility)
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

    const unreadEncouragementCount = encouragements.filter((e) => !e.read).length;
    const unreadCongratulationCount = congratulations.filter((c) => !c.read).length;
    const totalEncouragementCount = encouragements.length;
    const totalCongratulationCount = congratulations.length;

    const fetchKudosData = async () => {
        try {
            setLoading(true);

            // Fetch both in parallel
            const [encouragementsData, congratulationsData] = await Promise.all([
                getEncouragementsAPI().catch(() => []),
                getCongratulationsAPI().catch(() => []),
            ]);

            // Sort by timestamp (newest first)
            const sortedEncouragements = [...encouragementsData].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            const sortedCongratulations = [...congratulationsData].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setEncouragements(sortedEncouragements);
            setCongratulations(sortedCongratulations);
        } catch (error) {
            logger.error("Error fetching kudos data:", error);
        } finally {
            setLoading(false);
        }
    };

    const markEncouragementsAsRead = async () => {
        const unreadIds = encouragements.filter((e) => !e.read).map((e) => e.id);

        if (unreadIds.length > 0) {
            try {
                await markEncouragementsReadAPI(unreadIds);
                setEncouragements((prev) => prev.map((enc) => ({ ...enc, read: true })));
            } catch (error) {
                console.error("Error marking encouragements as read:", error);
            }
        }
    };

    const markCongratulationsAsRead = async () => {
        const unreadIds = congratulations.filter((c) => !c.read).map((c) => c.id);

        if (unreadIds.length > 0) {
            try {
                await markCongratulationsReadAPI(unreadIds);
                setCongratulations((prev) => prev.map((con) => ({ ...con, read: true })));
            } catch (error) {
                console.error("Error marking congratulations as read:", error);
            }
        }
    };

    useEffect(() => {
        fetchKudosData();
    }, []);

    const value: KudosContextType = {
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
    };

    return <KudosContext.Provider value={value}>{children}</KudosContext.Provider>;
};
