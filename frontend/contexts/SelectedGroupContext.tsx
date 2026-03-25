import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface SelectedGroupContextType {
    selectedGroupId: string | null;
    selectedGroupName: string | null;
    setSelectedGroup: (groupId: string | null, groupName: string | null) => void;
    clearSelectedGroup: () => void;
    getGroupIds: () => string[];
}

const SelectedGroupContext = createContext<SelectedGroupContextType | undefined>(undefined);

export const SelectedGroupProvider = ({ children }: { children: ReactNode }) => {
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);

    const setSelectedGroup = useCallback((groupId: string | null, groupName: string | null) => {
        setSelectedGroupId(groupId);
        setSelectedGroupName(groupName);
    }, []);

    const clearSelectedGroup = useCallback(() => {
        setSelectedGroupId(null);
        setSelectedGroupName(null);
    }, []);

    const getGroupIds = useCallback((): string[] => {
        if (selectedGroupId === null) return [];
        return [selectedGroupId];
    }, [selectedGroupId]);

    const value = useMemo(() => ({
        selectedGroupId,
        selectedGroupName,
        setSelectedGroup,
        clearSelectedGroup,
        getGroupIds,
    }), [selectedGroupId, selectedGroupName, setSelectedGroup, clearSelectedGroup, getGroupIds]);

    return (
        <SelectedGroupContext.Provider value={value}>
            {children}
        </SelectedGroupContext.Provider>
    );
};

export const useSelectedGroup = () => {
    const context = useContext(SelectedGroupContext);
    if (context === undefined) {
        throw new Error('useSelectedGroup must be used within a SelectedGroupProvider');
    }
    return context;
};
