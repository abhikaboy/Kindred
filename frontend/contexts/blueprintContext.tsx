import React, { createContext, useContext, useState } from "react";
import { subscribeToBlueprintToBackend, unsubscribeToBlueprintToBackend } from "@/api/blueprint";
import { useAuth } from "@/hooks/useAuth";
import type { components } from "@/api/generated/types";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];

type BlueprintContextType = {
    selectedBlueprint: BlueprintDocument | null;
    setSelectedBlueprint: (blueprint: BlueprintDocument) => void;
    getIsSubscribed: (id: string, subscribers: string[]) => boolean;
    getIsLoading: (id: string) => boolean;
    getSubscriberCount: (id: string, originalCount: number) => number;
    handleSubscribe: (id: string, subscribers: string[]) => Promise<boolean>;
};

const BlueprintCreationContext = createContext<BlueprintContextType | undefined>(undefined);

export const BlueprintCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedBlueprint, setSelectedBlueprintState] = useState<BlueprintDocument | null>(null);
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const { user } = useAuth();
    const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

    const setSelectedBlueprint = (blueprint: BlueprintDocument) => {
        setSelectedBlueprintState(blueprint);
        setSubscriberCounts((prev) => ({
            ...prev,
            [blueprint.id]: blueprint.subscribersCount,
        }));
    };

    const getIsSubscribed = (id: string, subscribers: string[]) => {
        if (user && user._id && subscribers) {
            return subscribers.includes(user._id);
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
                await unsubscribeToBlueprintToBackend(id);
                setSubscriberCounts((prev) => ({
                    ...prev,
                    [id]: Math.max(0, (prev[id] || 0) - 1),
                }));

                if (selectedBlueprint && selectedBlueprint.id === id) {
                    setSelectedBlueprintState({
                        ...selectedBlueprint,
                        subscribersCount: Math.max(0, selectedBlueprint.subscribersCount - 1),
                    });
                }

                return true;
            } else {
                await subscribeToBlueprintToBackend(id);
                setSubscriberCounts((prev) => ({
                    ...prev,
                    [id]: (prev[id] || 0) + 1,
                }));

                if (selectedBlueprint && selectedBlueprint.id === id) {
                    setSelectedBlueprintState({
                        ...selectedBlueprint,
                        subscribersCount: selectedBlueprint.subscribersCount + 1,
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
