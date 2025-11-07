import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedGroupContextType {
    selectedGroupId: string | null; // null means "All Friends"
    selectedGroupName: string | null;
    setSelectedGroup: (groupId: string | null, groupName: string | null) => void;
    clearSelectedGroup: () => void;
    getGroupIds: () => string[]; // Returns array of group IDs for API calls
}

const SelectedGroupContext = createContext<SelectedGroupContextType | undefined>(undefined);

export const SelectedGroupProvider = ({ children }: { children: ReactNode }) => {
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);

    const setSelectedGroup = (groupId: string | null, groupName: string | null) => {
        setSelectedGroupId(groupId);
        setSelectedGroupName(groupName);
    };

    const clearSelectedGroup = () => {
        setSelectedGroupId(null);
        setSelectedGroupName(null);
    };

    const getGroupIds = (): string[] => {
        // If "All Friends" is selected (null), return empty array
        // This tells the backend to make the post public to all friends
        if (selectedGroupId === null) {
            return [];
        }
        // Otherwise return the selected group ID
        return [selectedGroupId];
    };

    return (
        <SelectedGroupContext.Provider
            value={{
                selectedGroupId,
                selectedGroupName,
                setSelectedGroup,
                clearSelectedGroup,
                getGroupIds,
            }}
        >
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

