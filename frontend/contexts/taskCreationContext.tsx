import React, { createContext, useContext, useState } from "react";

type TaskCreationContextType = {
    taskName: string;
    setTaskName: (name: string) => void;
    resetTaskCreation: () => void;
};

const TaskCreationContext = createContext<TaskCreationContextType | undefined>(undefined);

export const TaskCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [taskName, setTaskName] = useState("");

    const resetTaskCreation = () => {
        setTaskName("");
    };

    return (
        <TaskCreationContext.Provider value={{ taskName, setTaskName, resetTaskCreation }}>
            {children}
        </TaskCreationContext.Provider>
    );
};

export const useTaskCreation = () => {
    const context = useContext(TaskCreationContext);
    if (context === undefined) {
        throw new Error("useTaskCreation must be used within a TaskCreationProvider");
    }
    return context;
};
