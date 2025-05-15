import { PRIORITY_MAP } from "@/components/cards/TaskCard";
import React, { createContext, useContext, useState } from "react";

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
}

type BlueprintContextType = {
    blueprints: Blueprint[];
    setBlueprints: React.Dispatch<React.SetStateAction<Blueprint[]>>;
    selectedBlueprint: Blueprint | null;
    setSelectedBlueprint: (blueprint: Blueprint) => void;
    getBlueprintById: (id: string) => Blueprint | undefined;
};

const BlueprintCreationContext = createContext<BlueprintContextType | undefined>(undefined);

export const BlueprintCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [selectedBlueprint, setSelectedBlueprintState] = useState<Blueprint | null>(null);

    const setSelectedBlueprint = (blueprint: Blueprint) => {
        setSelectedBlueprintState(blueprint);
    };
    const getBlueprintById = (id: string) => {
        return blueprints.find((blueprint) => blueprint.id === id);
    };

    const value = {
        blueprints,
        setBlueprints,
        selectedBlueprint,
        setSelectedBlueprint,
        getBlueprintById,
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
