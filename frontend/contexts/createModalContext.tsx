import React, { createContext, useContext, useState } from "react";
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

    const openModal = (config: CreateModalConfig = {}) => {
        setModalConfig(config);
        setVisible(true);
    };

    const closeModal = () => {
        setVisible(false);
        // Reset config after animation completes
        setTimeout(() => {
            setModalConfig({});
        }, 300);
    };

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

