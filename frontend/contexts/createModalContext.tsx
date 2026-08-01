import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Screen } from "@/components/modals/CreateModal";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

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
    const { capture } = useAnalytics();
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    const openModal = useCallback((config: CreateModalConfig = {}) => {
        capture(AnalyticsEvents.CREATE_MODAL_OPENED, {});
        // CreateModal stays permanently mounted (see _layout.tsx) and reacts to prop
        // changes rather than remounting, so replacing the whole config here is enough.
        setModalConfig(config);
        setVisible(true);
    }, []);

    const closeModal = useCallback(() => {
        setVisible(false);
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(() => {
            setModalConfig({});
        }, 300);
    }, []);

    const value = useMemo(() => ({
        visible,
        setVisible,
        openModal,
        closeModal,
        modalConfig,
    }), [visible, openModal, closeModal, modalConfig]);

    return (
        <CreateModalContext.Provider value={value}>
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
