import React, { createContext, useContext, useState, useCallback } from "react";
import { subscribeToBlueprintToBackend, unsubscribeToBlueprintToBackend } from "@/api/blueprint";
import { useAuth } from "@/hooks/useAuth";
import type { components } from "@/api/generated/types";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type CategoryDocument = components["schemas"]["CategoryDocument"];
type TaskDocument = components["schemas"]["TaskDocument"];

type BlueprintContextType = {
    selectedBlueprint: BlueprintDocument | null;
    setSelectedBlueprint: (blueprint: BlueprintDocument) => void;
    getIsSubscribed: (id: string, subscribers: string[]) => boolean;
    getIsLoading: (id: string) => boolean;
    getSubscriberCount: (id: string, originalCount: number) => number;
    handleSubscribe: (id: string, subscribers: string[]) => Promise<boolean>;
    categories: CategoryDocument[];
    setCategories: (categories: CategoryDocument[]) => void;
    // New blueprint creation context
    blueprintCategories: CategoryDocument[];
    addBlueprintCategory: (category: CategoryDocument) => void;
    removeBlueprintCategory: (categoryId: string) => void;
    addTaskToBlueprintCategory: (categoryId: string, task: TaskDocument) => void;
    removeTaskFromBlueprintCategory: (categoryId: string, taskId: string) => void;
    clearBlueprintData: () => void;
};

const BlueprintCreationContext = createContext<BlueprintContextType | undefined>(undefined);

export const BlueprintCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedBlueprint, setSelectedBlueprintState] = useState<BlueprintDocument | null>(null);
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const { user } = useAuth();
    const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
    const [categories, setCategories] = useState<CategoryDocument[]>([]);
    
    // New state for blueprint creation
    const [blueprintCategories, setBlueprintCategories] = useState<CategoryDocument[]>([]);

    const setSelectedBlueprint = useCallback((blueprint: BlueprintDocument) => {
        setSelectedBlueprintState(blueprint);
        setSubscriberCounts((prev) => ({
            ...prev,
            [blueprint.id]: blueprint.subscribersCount,
        }));
    }, []);

    const getIsSubscribed = useCallback((id: string, subscribers: string[]) => {
        if (user && user._id && subscribers) {
            return subscribers.includes(user._id);
        }
        return false;
    }, [user]);

    const getSubscriberCount = useCallback((id: string, originalCount: number) => {
        return subscriberCounts[id] !== undefined ? subscriberCounts[id] : originalCount;
    }, [subscriberCounts]);

    const getIsLoading = useCallback((id: string) => {
        return loadingStates[id] || false;
    }, [loadingStates]);

    const handleSubscribe = useCallback(async (id: string, subscribers: string[]) => {
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
    }, [user, selectedBlueprint, getIsSubscribed]);

    // New functions for blueprint creation
    const addBlueprintCategory = useCallback((category: CategoryDocument) => {
        setBlueprintCategories((prev) => {
            // Check if category already exists
            const exists = prev.some(cat => cat.id === category.id);
            if (exists) {
                return prev;
            }
            return [...prev, category];
        });
    }, []);

    const removeBlueprintCategory = useCallback((categoryId: string) => {
        setBlueprintCategories((prev) => prev.filter(cat => cat.id !== categoryId));
    }, []);

    const addTaskToBlueprintCategory = useCallback((categoryId: string, task: TaskDocument) => {
        setBlueprintCategories((prev) => 
            prev.map(category => {
                if (category.id === categoryId) {
                    return {
                        ...category,
                        tasks: [...category.tasks, task]
                    };
                }
                return category;
            })
        );
    }, []);

    const removeTaskFromBlueprintCategory = useCallback((categoryId: string, taskId: string) => {
        setBlueprintCategories((prev) => 
            prev.map(category => {
                if (category.id === categoryId) {
                    return {
                        ...category,
                        tasks: category.tasks.filter(task => task.id !== taskId)
                    };
                }
                return category;
            })
        );
    }, []);

    const clearBlueprintData = useCallback(() => {
        setBlueprintCategories([]);
    }, []);

    const value = {
        selectedBlueprint,
        setSelectedBlueprint,
        getIsSubscribed,
        getIsLoading,
        handleSubscribe,
        getSubscriberCount,
        categories,
        setCategories,
        // New blueprint creation context
        blueprintCategories,
        addBlueprintCategory,
        removeBlueprintCategory,
        addTaskToBlueprintCategory,
        removeTaskFromBlueprintCategory,
        clearBlueprintData,
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
