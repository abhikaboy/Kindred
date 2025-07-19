import React, { createContext, useContext, useState } from "react";
import { subscribeToBlueprintToBackend, unsubscribeToBlueprintToBackend } from "@/api/blueprint";
import { useAuth } from "@/hooks/useAuth";

export interface Blueprint {
    id: string;
    previewImage: string;
    userImage: string;
    workspaceName: string;
    username: string;
    name: string;
    time: string;
    subscriberCount: number;
    description: string;
    tags: string[];
    subscribers?: string[];
}

type BlueprintContextType = {
    selectedBlueprint: Blueprint | null;
    setSelectedBlueprint: (blueprint: Blueprint) => void;
    getIsSubscribed: (id: string, subscribers: string[]) => boolean;
    getIsLoading: (id: string) => boolean;
    getSubscriberCount: (id: string, originalCount: number) => number;
    handleSubscribe: (id: string, subscribers: string[]) => Promise<boolean>;
};

const BlueprintCreationContext = createContext<BlueprintContextType | undefined>(undefined);

export const BlueprintCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedBlueprint, setSelectedBlueprintState] = useState<Blueprint | null>(null);
    const [subscriptionStates, setSubscriptionStates] = useState<Record<string, boolean>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const { user } = useAuth();
    const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({}); 

    const setSelectedBlueprint = (blueprint: Blueprint) => {
        setSelectedBlueprintState(blueprint);
        setSubscriberCounts((prev) => ({
            ...prev,
            [blueprint.id]: blueprint.subscriberCount,
        }));
    };

    const getIsSubscribed = (id: string, subscribers: string[]) => {
        if (subscriptionStates[id] !== undefined) {
            return subscriptionStates[id];
        }
        if (user && user._id && subscribers) {
            const isSubscribed = subscribers.includes(user._id);
            setSubscriptionStates((prev) => ({ ...prev, [id]: isSubscribed }));
            return isSubscribed;
        }
        return false;
    };

    const getSubscriberCount = (id: string, originalCount: number) => {
        return subscriberCounts[id] !== undefined ? subscriberCounts[id] : originalCount;
    };

    const getIsLoading = (id: string) => {
        return loadingStates[id] || false;
    };

    const handleSubscribe = async (id: string, subscribers: string[]) => {
        if (!user || !user._id) {
            console.error("User not authenticated");
            return false;
        }

        try {
            setLoadingStates((prev) => ({ ...prev, [id]: true }));

            const currentIsSubscribed = getIsSubscribed(id, subscribers);

            if (currentIsSubscribed) {
                setSubscriptionStates((prev) => ({ ...prev, [id]: false }));

                setSubscriberCounts((prev) => ({
                    ...prev,
                    [id]: Math.max(0, (prev[id] || 0) - 1), 
                }));

                if (selectedBlueprint && selectedBlueprint.id === id) {
                    setSelectedBlueprintState({
                        ...selectedBlueprint,
                        subscriberCount: Math.max(0, selectedBlueprint.subscriberCount - 1),
                    });
                }

                return true;
            } else {
                setSubscriptionStates((prev) => ({ ...prev, [id]: true }));
                setSubscriberCounts((prev) => ({
                    ...prev,
                    [id]: (prev[id] || 0) + 1,
                }));

                if (selectedBlueprint && selectedBlueprint.id === id) {
                    setSelectedBlueprintState({
                        ...selectedBlueprint,
                        subscriberCount: selectedBlueprint.subscriberCount + 1,
                    });
                }
                return true;
            }
        } catch (error) {
            return false;
        } finally {
            setLoadingStates((prev) => ({ ...prev, [id]: false }));
        }
    };

    const value = {
        selectedBlueprint,
        setSelectedBlueprint,
        getIsSubscribed,
        getIsLoading,
        handleSubscribe,
        getSubscriberCount,
    };

    return <BlueprintCreationContext.Provider value={value}>{children}</BlueprintCreationContext.Provider>;
};

export function useBlueprints() {
    const context = useContext(BlueprintCreationContext);
    if (context === undefined) {
        throw new Error("useBlueprints must be used within a BlueprintsProvider");
    }
    return context;
}
