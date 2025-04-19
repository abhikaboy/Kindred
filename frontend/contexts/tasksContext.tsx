import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import React, { useEffect } from "react";
import { createContext, useState, useContext } from "react";
import { Task, Workspace, Categories } from "../api/types";
import { fetchUserWorkspaces, createWorkspace } from "@/api/workspace";

const TaskContext = createContext<TaskContextType>({} as TaskContextType);

type TaskContextType = {
    workspaces: Workspace[];
    setWorkSpaces: (workspaces: Workspace[]) => void;
    getWorkspace: (name: string) => Workspace;
    fetchWorkspaces: () => void;
    selected: string;
    setSelected: (selected: string) => void;
    categories: Categories[];
    addToCategory: (categoryId: string, task: Task) => void;
    addToWorkspace: (name: string, category: Categories) => void;
    addWorkspace: (name: string, category: Categories) => void;
    removeFromCategory: (categoryId: string, taskId: string) => void;
    removeFromWorkspace: (name: string, categoryId: string) => void;

    setCreateCategory: (Option: Option) => void;
    selectedCategory: Option;
    showConfetti: boolean;
    setShowConfetti: (showConfetti: boolean) => void;
};

export function TasksProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [workspaces, setWorkSpaces] = useState<Workspace[]>([]);
    const [selected, setSelected] = useState<string>("Good Morning ☀️"); // Workspace
    const [categories, setCategories] = useState<Categories[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Option>({ label: "", id: "", special: false });

    const [showConfetti, setShowConfetti] = useState(false);
    /**
     * Sets the selected category within the creation menu
     * @param option
     */
    const setCreateCategory = (option: Option) => {
        setSelectedCategory(option);
    };

    /**
     * Gets a workspace by name from the list of workspaces
     * @param name
     * @returns Workspace
     */
    const getWorkspace = (name: string) => {
        return workspaces.find((workspace) => workspace.name === name);
    };

    const fetchWorkspaces = async () => {
        const data = await fetchUserWorkspaces(user._id);
        setWorkSpaces(data);
    };

    /**
     * Adds a workspace to the list of workspaces on the server and locally
     * @param name
     * @param category
     */
    const addWorkspace = async (name: string, category: Categories) => {
        const newWorkspace = { name: name, categories: [category] };
        await createWorkspace(name);
        let workspacesCopy = workspaces.slice();
        workspacesCopy.push(newWorkspace);
        setWorkSpaces(workspacesCopy);
    };

    /**
     * Adds a task to the list of categories
     * @param categoryId
     * @param task
     */
    const addToCategory = async (categoryId: string, task: Task) => {
        let categoriesCopy = categories.slice();
        categoriesCopy.find((category) => category.id === categoryId).tasks.push(task);
        setCategories(categoriesCopy);
    };

    /**
     * Adds a category to the workspace list
     * @param name
     * @param category
     */

    const addToWorkspace = (name: string, category: Categories) => {
        const workspace = getWorkspace(name);
        if (!workspace) return;
        let workspacesCopy = workspaces.slice();
        workspacesCopy.find((workspace) => workspace.name === name).categories.push(category);
        setWorkSpaces(workspacesCopy);
    };
    /**
     * Visually will remove a task from a category locally
     * @param categoryId
     * @param taskId
     */
    const removeFromCategory = async (categoryId: string, taskId: string) => {
        let categoriesCopy = categories.slice();
        categoriesCopy.find((category) => category.id === categoryId).tasks = categoriesCopy
            .find((category) => category.id === categoryId)
            .tasks.filter((task) => task.id !== taskId);
        setCategories(categoriesCopy);
    };

    /**
     * Removes a category from a workspace locally
     * @param name
     * @param categoryId
     */
    const removeFromWorkspace = async (name: string, categoryId: string) => {
        let workspacesCopy = workspaces.slice();
        workspacesCopy.find((workspace) => workspace.name === name).categories = workspacesCopy
            .find((workspace) => workspace.name === name)
            .categories.filter((category) => category.id !== categoryId);
        setWorkSpaces(workspacesCopy);
    };

    useEffect(() => {
        if (workspaces.length === 0) return;
        const selectedWorkspace = getWorkspace(selected);
        if (selectedWorkspace == null) return;
        setCategories(selectedWorkspace.categories);
    }, [selected, workspaces]);

    return (
        <TaskContext.Provider
            value={{
                workspaces,
                setWorkSpaces,
                getWorkspace,
                fetchWorkspaces,
                selected,
                setSelected,
                categories,
                addToCategory,
                addToWorkspace,
                addWorkspace,
                removeFromCategory,
                removeFromWorkspace,
                setCreateCategory,
                selectedCategory,
                showConfetti,
                setShowConfetti,
            }}>
            {children}
        </TaskContext.Provider>
    );
}

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error("useTasks must be used within a TasksProvider");
    }
    return context;
};
