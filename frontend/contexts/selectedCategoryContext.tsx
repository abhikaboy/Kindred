import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTasks } from "@/contexts/tasksContext";

type SelectedCategoryContextType = {
    selectedCategory: Option;
    setCreateCategory: (option: Option) => void;
};

const SelectedCategoryContext = createContext<SelectedCategoryContextType | null>(null);

// Split out of TasksProvider: this changes on every category tap, and putting it in the
// same context as workspaces/tasks re-rendered the entire mounted task tree on every tap.
// Must be rendered inside TasksProvider (reads `selected` to clear the category on workspace switch).
export function SelectedCategoryProvider({ children }: { children: React.ReactNode }) {
    const { selected } = useTasks();
    const [selectedCategory, setSelectedCategory] = useState<Option>({ label: "", id: "", special: false });

    useEffect(() => {
        setSelectedCategory({ label: "", id: "", special: false });
    }, [selected]);

    const setCreateCategory = useCallback((option: Option) => {
        if (option.id === "" || option.label === "") return;
        setSelectedCategory(option);
    }, []);

    const value = useMemo(() => ({ selectedCategory, setCreateCategory }), [selectedCategory, setCreateCategory]);

    return <SelectedCategoryContext.Provider value={value}>{children}</SelectedCategoryContext.Provider>;
}

export const useSelectedCategory = () => {
    const context = useContext(SelectedCategoryContext);
    if (!context) {
        throw new Error("useSelectedCategory must be used within a SelectedCategoryProvider");
    }
    return context;
};
