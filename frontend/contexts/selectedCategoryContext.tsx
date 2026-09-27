import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTasksSelector } from "@/contexts/tasksContext";

type SelectedCategoryContextType = {
    selectedCategory: Option;
    setCreateCategory: (option: Option) => void;
};

const EMPTY_CATEGORY: Option = { label: "", id: "", special: false };
const isEmptyCategory = (o: Option) => o.label === "" && o.id === "" && !o.special;

const SelectedCategoryContext = createContext<SelectedCategoryContextType | null>(null);
// Setter only, stable — categories/new-category flows don't re-render when the selection changes.
const SetCreateCategoryContext = createContext<((option: Option) => void) | null>(null);

// Split out of TasksProvider: this changes on every category tap, and putting it in the
// same context as workspaces/tasks re-rendered the entire mounted task tree on every tap.
// Must be rendered inside TasksProvider (reads `selected` to clear the category on workspace switch).
export function SelectedCategoryProvider({ children }: { children: React.ReactNode }) {
    const selected = useTasksSelector((s) => s.selected);
    const [selectedCategory, setSelectedCategory] = useState<Option>(EMPTY_CATEGORY);

    // Keep the same reference when already empty so consumers don't re-render on every swipe
    useEffect(() => {
        setSelectedCategory((prev) => (isEmptyCategory(prev) ? prev : EMPTY_CATEGORY));
    }, [selected]);

    const setCreateCategory = useCallback((option: Option) => {
        if (option.id === "" || option.label === "") return;
        setSelectedCategory(option);
    }, []);

    const value = useMemo(() => ({ selectedCategory, setCreateCategory }), [selectedCategory, setCreateCategory]);

    return (
        <SetCreateCategoryContext.Provider value={setCreateCategory}>
            <SelectedCategoryContext.Provider value={value}>{children}</SelectedCategoryContext.Provider>
        </SetCreateCategoryContext.Provider>
    );
}

export const useSelectedCategory = () => {
    const context = useContext(SelectedCategoryContext);
    if (!context) {
        throw new Error("useSelectedCategory must be used within a SelectedCategoryProvider");
    }
    return context;
};

export const useSetCreateCategory = () => {
    const context = useContext(SetCreateCategoryContext);
    if (!context) {
        throw new Error("useSetCreateCategory must be used within a SelectedCategoryProvider");
    }
    return context;
};
