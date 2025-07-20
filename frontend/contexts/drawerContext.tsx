import React, { createContext, useContext, useState } from "react";

type DrawerContextType = {
    isDrawerOpen: boolean;
    setIsDrawerOpen: (isOpen: boolean) => void;
};

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export const DrawerProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const value = {
        isDrawerOpen,
        setIsDrawerOpen,
    };

    return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};

export const useDrawer = () => {
    const context = useContext(DrawerContext);
    if (!context) {
        throw new Error("useDrawer must be used within a DrawerProvider");
    }
    return context;
};
