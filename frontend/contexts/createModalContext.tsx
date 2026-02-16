import React, { createContext, useContext, useState, useCallback } from "react";
import { Screen } from "@/components/modals/CreateModal";

type CreateModalContextType = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    openModal: (config?: CreateModalConfig) => void;
    closeModal: () => void;
    modalConfig: CreateModalConfig;
};

export type CreateModalConfig = {
    edit?: boolean;
    screen?: Screen;
    categoryId?: string;
    isBlueprint?: boolean;
};

const CreateModalContext = createContext<CreateModalContextType | undefined>(undefined);

export const CreateModalProvider = ({ children }: { children: React.ReactNode }) => {
    const [visible, setVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<CreateModalConfig>({});

    const openModal = useCallback((config: CreateModalConfig = {}) => {
        // Force close first if already open to reset state
        if (visible) {
            setVisible(false);
            setTimeout(() => {
                setModalConfig(config);
                setVisible(true);
            }, 100);
        } else {
            setModalConfig(config);
            setVisible(true);
        }
    }, [visible]);

    const closeModal = useCallback(() => {
        setVisible(false);
        // Reset config after animation completes
        setTimeout(() => {
            setModalConfig({});
        }, 300);
    }, []);

    return (
        <CreateModalContext.Provider
            value={{
                visible,
                setVisible,
                openModal,
                closeModal,
                modalConfig,
            }}>
            {children}
        </CreateModalContext.Provider>
    );
};

export const useCreateModal = () => {
    const context = useContext(CreateModalContext);
    if (context === undefined) {
        throw new Error("useCreateModal must be used within a CreateModalProvider");
    }
    return context;
};
