import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import React, { useEffect, useMemo } from "react";
import { createContext, useState, useContext } from "react";
import { Task, Workspace, Categories } from "../api/types";
import { fetchUserWorkspaces, createWorkspace } from "@/api/workspace";
import { isFuture, isPast, isToday } from "date-fns";

const TaskContext = createContext<TaskContextType>({} as TaskContextType);

type TaskContextType = {
    workspaces: Workspace[];
    setWorkSpaces: (workspaces: Workspace[]) => void;
    getWorkspace: (name: string) => Workspace;
    fetchWorkspaces: () => void;
    selected: string; // workspace name
    setSelected: (selected: string) => void; // workspace name
    categories: Categories[];
    addToCategory: (categoryId: string, task: Task) => void;
    addToWorkspace: (name: string, category: Categories) => void;
    addWorkspace: (name: string, category: Categories) => void;
    removeFromCategory: (categoryId: string, taskId: string) => void;
    removeFromWorkspace: (name: string, categoryId: string) => void;
    fetchingWorkspaces: boolean;

    setCreateCategory: (Option: Option) => void;
    selectedCategory: Option; // category name
    showConfetti: boolean;
    setShowConfetti: (showConfetti: boolean) => void;

    task: Task | null;
    setTask: (task: Task | null) => void;
    doesWorkspaceExist: (name: string) => boolean;
    unnestedTasks: Task[];
    startTodayTasks: Task[];
    dueTodayTasks: Task[];
    pastStartTasks: Task[];
    pastDueTasks: Task[];
    futureTasks: Task[];
    allTasks: Task[];
};

export function TasksProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [workspaces, setWorkSpaces] = useState<Workspace[]>([]);
    const [selected, setSelected] = useState<string>(""); // Workspace
    const [categories, setCategories] = useState<Categories[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Option>({ label: "", id: "", special: false });
    const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false);
    const [task, setTask] = useState<Task | null>(null);

    const [showConfetti, setShowConfetti] = useState(false);

    const unnestedTasks = useMemo(() => {
        let res = workspaces
            .flatMap((workspace) => workspace.categories)
            .flatMap((category) =>
                category.tasks.map((task) => ({
                    ...task,
                    categoryID: category.id,
                    categoryName: category.name,
                }))
            );
        return res;
    }, [workspaces]);

    const startTodayTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            return isToday(new Date(task?.startDate));
        });
    }, [unnestedTasks]);

    const dueTodayTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            return isToday(new Date(task?.deadline));
        });
    }, [unnestedTasks]);

    const pastStartTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            return isPast(new Date(task?.startDate));
        });
    }, [unnestedTasks]);

    const pastDueTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            return isPast(new Date(task?.deadline));
        });
    }, [unnestedTasks]);

    const futureTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            return isFuture(new Date(task?.deadline));
        });
    }, [unnestedTasks]);

    const allTasks = useMemo(() => {
        return unnestedTasks;
    }, [unnestedTasks]);

    /**
     * Sets the selected category within the creation menu
     * @param option
     */
    const setCreateCategory = (option: Option) => {
        if (option.id == "") return;
        if (option.label == "") return;
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
        setFetchingWorkspaces(true);
        console.log("fetching workspaces via API");
        const data = await fetchUserWorkspaces(user._id);
        setWorkSpaces(data);
        setFetchingWorkspaces(false);
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

    const doesWorkspaceExist = (name: string) => {
        for (const workspace of workspaces) {
            if (workspace.name === name) return true;
        }
        return false;
    };

    useEffect(() => {
        console.log("Change to selected Workspace has occured");
        console.log(selected);
        if (workspaces.length === 0) return;
        const selectedWorkspace = getWorkspace(selected);
        if (selectedWorkspace == null) return;
        setCategories(selectedWorkspace.categories);
        setSelectedCategory({ label: "", id: "", special: false });
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
                task,
                setTask,
                doesWorkspaceExist,
                unnestedTasks,
                startTodayTasks,
                dueTodayTasks,
                pastStartTasks,
                pastDueTasks,
                futureTasks,
                allTasks,
                fetchingWorkspaces,
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
