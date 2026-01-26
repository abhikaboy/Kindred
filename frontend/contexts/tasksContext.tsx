import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import React, { useEffect, useMemo } from "react";
import { createContext, useState, useContext } from "react";
import { Task, Workspace, Categories, BlueprintWorkspace } from "../api/types";
import { fetchUserWorkspaces, createWorkspace } from "@/api/workspace";
import { renameWorkspace as renameWorkspaceAPI, renameCategory as renameCategoryAPI } from "@/api/category";
import { isFuture, isPast, isToday, isWithinInterval } from "date-fns";
import { getUserSubscribedBlueprints } from "@/api/blueprint";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TaskContext = createContext<TaskContextType>({} as TaskContextType);

type TaskContextType = {
    workspaces: Workspace[];
    setWorkSpaces: (workspaces: Workspace[]) => void;
    getWorkspace: (name: string) => Workspace;
    fetchWorkspaces: (forceRefresh?: boolean) => Promise<void>;
    selected: string; // workspace name
    setSelected: (selected: string) => void; // workspace name
    categories: Categories[];
    addToCategory: (categoryId: string, task: Task) => void;
    addToWorkspace: (name: string, category: Categories) => void;
    addWorkspace: (name: string, category: Categories) => void;
    updateTask: (categoryId: string, taskId: string, updates: Partial<Task>) => void;
    removeFromCategory: (categoryId: string, taskId: string) => void;
    removeFromWorkspace: (name: string, categoryId: string) => void;
    removeWorkspace: (name: string) => void;
    restoreWorkspace: (workspace: Workspace) => void;
    renameWorkspace: (oldName: string, newName: string) => Promise<void>;
    renameCategory: (categoryId: string, newName: string) => Promise<void>;
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
    windowTasks: Task[];
    recentWorkspaces: string[];
    getRecentWorkspaces: () => string[];
    clearRecentWorkspaces: () => Promise<void>;
};

export function TasksProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [workspaces, setWorkSpaces] = useState<Workspace[]>([]);
    const [selected, setSelected] = useState<string>(""); // Workspace
    const [categories, setCategories] = useState<Categories[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Option>({ label: "", id: "", special: false });
    const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false);
    const [task, setTask] = useState<Task | null>(null);
    const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);

    const [showConfetti, setShowConfetti] = useState(false);
    
    // Constants for recent workspaces and caching
    const RECENT_WORKSPACES_KEY = `recent_workspaces_${user?._id || 'default'}`;
    const MAX_RECENT_WORKSPACES = 6;
    const WORKSPACES_CACHE_KEY = `workspaces_cache_${user?._id || 'default'}`;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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

    const windowTasks = useMemo(() => {
        return unnestedTasks.filter((task) => {
            const today = new Date();
            const startDate = new Date(task?.startDate);
            const deadline = new Date(task?.deadline);
            
            // Check if today falls between start date and deadline
            return startDate <= today && today <= deadline;
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

    /**
     * Invalidates the workspaces cache by removing it from AsyncStorage
     * This should be called after any local update to prevent stale cache from overwriting local changes
     */
    const invalidateWorkspacesCache = async () => {
        try {
            await AsyncStorage.removeItem(WORKSPACES_CACHE_KEY);
            console.log("Workspaces cache invalidated");
        } catch (error) {
            console.error("Error invalidating workspaces cache:", error);
        }
    };

    const fetchWorkspaces = async (forceRefresh: boolean = false) => {
        if (!user?._id) return;
        
        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            try {
                const cached = await AsyncStorage.getItem(WORKSPACES_CACHE_KEY);
                if (cached) {
                    const { data: cachedData, timestamp } = JSON.parse(cached);
                    const now = Date.now();
                    
                    // Use cache if it's less than 5 minutes old
                    if ((now - timestamp) < CACHE_DURATION) {
                        console.log("Using cached workspaces (age: " + Math.floor((now - timestamp) / 1000) + "s)");
                        setWorkSpaces(cachedData);
                        return;
                    } else {
                        console.log("Cache expired, fetching fresh data");
                    }
                }
            } catch (error) {
                console.error("Error reading workspaces cache:", error);
            }
        } else {
            console.log("Force refresh requested, bypassing cache");
        }

        // Fetch fresh data
        setFetchingWorkspaces(true);
        try {
            console.log("Fetching workspaces via API");
            const data = await fetchUserWorkspaces(user._id);
            const subscribedBlueprints = await getUserSubscribedBlueprints();
            console.log("subscribedBlueprints", subscribedBlueprints);
            const blueprintWorkspaces: BlueprintWorkspace[] = subscribedBlueprints.map((blueprint) => {
                return {
                    name: blueprint.name,
                    categories: [],
                    blueprintDetails: blueprint,
                    isBlueprint: true
                }
            });
            console.log("blueprintWorkspaces", blueprintWorkspaces);

            const allWorkspaces = [...data, ...blueprintWorkspaces];
            setWorkSpaces(allWorkspaces);

            // Save to cache
            try {
                await AsyncStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify({
                    data: allWorkspaces,
                    timestamp: Date.now()
                }));
                console.log("Workspaces cached successfully");
            } catch (error) {
                console.error("Error caching workspaces:", error);
            }
        } catch (error) {
            console.error("Error fetching workspaces:", error);
            throw error;
        } finally {
            setFetchingWorkspaces(false);
        }
    };

    /**
     * Adds a workspace to the list of workspaces on the server and locally
     * @param name
     * @param category
     */
    const addWorkspace = async (name: string, category: Categories) => {
        const newWorkspace = { name: name, categories: [category], isBlueprint: false };
        await createWorkspace(name);
        let workspacesCopy = workspaces.slice();
        workspacesCopy.push(newWorkspace);
        setWorkSpaces(workspacesCopy);
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
    };

    /**
     * Adds a task to the list of categories
     * @param categoryId
     * @param task
     */
    const addToCategory = async (categoryId: string, task: Task) => {
        // Create a deep copy of workspaces to avoid mutations
        let workspacesCopy = JSON.parse(JSON.stringify(workspaces));
        
        // Update workspaces state - this will automatically update categories via useEffect
        workspacesCopy.forEach((workspace: Workspace) => {
            workspace.categories.forEach((category: Categories) => {
                if (category.id === categoryId) {
                    // Ensure the task has the categoryName field populated
                    const taskWithCategoryName = {
                        ...task,
                        categoryName: category.name,
                    };
                    category.tasks.push(taskWithCategoryName);
                }
            });
        });
        
        setWorkSpaces(workspacesCopy);
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
    };

    /**
     * Updates a task in the workspaces and categories (optimistic update)
     * @param categoryId - The ID of the category containing the task
     * @param taskId - The ID of the task to update
     * @param updates - Partial task object with fields to update
     */
    const updateTask = (categoryId: string, taskId: string, updates: Partial<Task>) => {
        // Create a deep copy of workspaces to avoid mutations
        let workspacesCopy = JSON.parse(JSON.stringify(workspaces));
        let categoryName: string | undefined;
        let updatedTask: Task | null = null;
        
        // Update workspaces state - this will automatically update categories via useEffect
        workspacesCopy.forEach((workspace: Workspace) => {
            workspace.categories.forEach((category: Categories) => {
                if (category.id === categoryId) {
                    const taskIndex = category.tasks.findIndex((t) => t.id === taskId);
                    if (taskIndex !== -1) {
                        category.tasks[taskIndex] = {
                            ...category.tasks[taskIndex],
                            ...updates,
                            categoryName: category.name, // Ensure categoryName is preserved
                        };
                        categoryName = category.name;
                        updatedTask = category.tasks[taskIndex];
                    }
                }
            });
        });
        
        setWorkSpaces(workspacesCopy);

        // Update the selected task if it's the one being edited
        if (task && task.id === taskId && updatedTask) {
            setTask({
                ...task,
                ...updates,
                categoryName: categoryName, // Ensure categoryName is preserved
            });
        }

        // Invalidate cache after local update
        invalidateWorkspacesCache();
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
        // Invalidate cache after local update
        invalidateWorkspacesCache();
    };
    /**
     * Visually will remove a task from a category locally
     * @param categoryId
     * @param taskId
     */
    const removeFromCategory = async (categoryId: string, taskId: string) => {
        // Create a deep copy of workspaces to avoid mutations
        let workspacesCopy = JSON.parse(JSON.stringify(workspaces));
        
        // Update workspaces state - this will automatically update categories via useEffect
        workspacesCopy.forEach((workspace: Workspace) => {
            workspace.categories.forEach((category: Categories) => {
                if (category.id === categoryId) {
                    category.tasks = category.tasks.filter((task: Task) => task.id !== taskId);
                }
            });
        });
        
        setWorkSpaces(workspacesCopy);
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
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
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
    };

    /**
     * Removes a workspace from the workspaces list locally
     * @param name - The name of the workspace to remove
     */
    const removeWorkspace = (name: string) => {
        let workspacesCopy = workspaces.slice();
        workspacesCopy = workspacesCopy.filter((workspace) => workspace.name !== name);
        setWorkSpaces(workspacesCopy);
        
        // If the deleted workspace was selected, select the first available workspace
        if (selected === name && workspacesCopy.length > 0) {
            setSelected(workspacesCopy[0].name);
        } else if (selected === name && workspacesCopy.length === 0) {
            setSelected("");
        }
        
        // Invalidate cache after local update
        invalidateWorkspacesCache();
    };

    /**
     * Restores a workspace to the workspaces list (for rollback after failed API calls)
     * @param workspace - The workspace to restore
     */
    const restoreWorkspace = async (workspace: Workspace) => {
        let workspacesCopy = workspaces.slice();
        workspacesCopy.push(workspace);
        setWorkSpaces(workspacesCopy);
        
        // Invalidate cache after local update for consistency
        await invalidateWorkspacesCache();
        
        // If no workspace is currently selected, select the restored one
        if (selected === "") {
            setSelected(workspace.name);
        }
    };

    const doesWorkspaceExist = (name: string) => {
        for (const workspace of workspaces) {
            if (workspace.name === name) return true;
        }
        return false;
    };

    /**
     * Load recent workspaces from AsyncStorage
     */
    const loadRecentWorkspaces = async () => {
        try {
            const storedRecents = await AsyncStorage.getItem(RECENT_WORKSPACES_KEY);
            if (storedRecents) {
                const parsedRecents = JSON.parse(storedRecents);
                setRecentWorkspaces(parsedRecents);
            }
        } catch (error) {
            console.error('Error loading recent workspaces:', error);
        }
    };

    /**
     * Add a workspace to recent workspaces
     * @param workspaceName - The name of the workspace to add
     */
    const addToRecentWorkspaces = async (workspaceName: string) => {
        if (!workspaceName || workspaceName.trim() === '') return;

        try {
            let updatedRecents = [...recentWorkspaces];
            
            // Remove the workspace if it already exists to avoid duplicates
            updatedRecents = updatedRecents.filter(name => name !== workspaceName);
            
            // Add to the beginning of the array
            updatedRecents.unshift(workspaceName);
            
            // Limit to MAX_RECENT_WORKSPACES
            updatedRecents = updatedRecents.slice(0, MAX_RECENT_WORKSPACES);
            
            // Save to AsyncStorage
            await AsyncStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(updatedRecents));
            
            // Update state
            setRecentWorkspaces(updatedRecents);
        } catch (error) {
            console.error('Error adding to recent workspaces:', error);
        }
    };

    /**
     * Get recent workspaces
     * @returns Array of recent workspace names
     */
    const getRecentWorkspaces = () => {
        return recentWorkspaces;
    };

    /**
     * Clear all recent workspaces
     */
    const clearRecentWorkspaces = async () => {
        try {
            await AsyncStorage.removeItem(RECENT_WORKSPACES_KEY);
            setRecentWorkspaces([]);
        } catch (error) {
            console.error('Error clearing recent workspaces:', error);
        }
    };

    /**
     * Custom setSelected function that also adds to recent workspaces
     * @param workspaceName - The name of the workspace to select
     */
    const handleSetSelected = (workspaceName: string) => {
        // First set the selected workspace immediately (synchronous)
        setSelected(workspaceName);
        
        // Defer AsyncStorage write to avoid blocking the UI
        if (workspaceName && workspaceName.trim() !== '') {
            // Use setTimeout to defer the async operation
            setTimeout(() => {
                addToRecentWorkspaces(workspaceName);
            }, 0);
        }
    };

    /**
     * Renames a workspace by updating all its categories on the server and locally
     * @param oldName - The current name of the workspace
     * @param newName - The new name for the workspace
     */
    const renameWorkspace = async (oldName: string, newName: string) => {
        // Store the workspace data for potential rollback
        const workspaceToRename = getWorkspace(oldName);
        
        // Optimistic update - immediately update the UI
        let workspacesCopy = workspaces.slice();
        const workspaceIndex = workspacesCopy.findIndex(w => w.name === oldName);
        if (workspaceIndex !== -1) {
            workspacesCopy[workspaceIndex].name = newName;
            setWorkSpaces(workspacesCopy);
            
            // If the renamed workspace was selected, update the selection
            if (selected === oldName) {
                setSelected(newName);
            }
        }
        
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
        
        try {
            // Call the API to rename the workspace
            await renameWorkspaceAPI(oldName, newName);
            
            // Refresh workspaces to ensure consistency
            await fetchWorkspaces();
        } catch (error) {
            console.error("Error renaming workspace:", error);
            
            // Rollback the optimistic update on error
            if (workspaceToRename) {
                let workspacesCopy = workspaces.slice();
                const workspaceIndex = workspacesCopy.findIndex(w => w.name === newName);
                if (workspaceIndex !== -1) {
                    workspacesCopy[workspaceIndex].name = oldName;
                    setWorkSpaces(workspacesCopy);
                    
                    // Invalidate cache after rollback for consistency
                    await invalidateWorkspacesCache();
                    
                    // Restore the original selection if it was changed
                    if (selected === newName) {
                        setSelected(oldName);
                    }
                }
            }
            
            throw error;
        }
    };

    /**
     * Renames a category by updating it on the server and locally
     * @param categoryId - The ID of the category to rename
     * @param newName - The new name for the category
     */
    const renameCategory = async (categoryId: string, newName: string) => {
        // Store the original category data for potential rollback
        let originalCategory: Categories | null = null;
        let workspaceIndex = -1;
        let categoryIndex = -1;
        
        // Find the category and store its original state
        for (let i = 0; i < workspaces.length; i++) {
            const catIndex = workspaces[i].categories.findIndex(c => c.id === categoryId);
            if (catIndex !== -1) {
                workspaceIndex = i;
                categoryIndex = catIndex;
                originalCategory = { ...workspaces[i].categories[catIndex] };
                break;
            }
        }
        
        if (!originalCategory) {
            throw new Error("Category not found");
        }
        
        // Optimistic update - immediately update the UI
        let workspacesCopy = workspaces.slice();
        workspacesCopy[workspaceIndex].categories[categoryIndex].name = newName;
        setWorkSpaces(workspacesCopy);
        
        // Invalidate cache after local update
        await invalidateWorkspacesCache();
        
        try {
            // Call the API to rename the category
            await renameCategoryAPI(categoryId, newName);
            
            // Refresh workspaces to ensure consistency
            await fetchWorkspaces();
        } catch (error) {
            console.error("Error renaming category:", error);
            
            // Rollback the optimistic update on error
            if (originalCategory && workspaceIndex !== -1 && categoryIndex !== -1) {
                let workspacesCopy = workspaces.slice();
                workspacesCopy[workspaceIndex].categories[categoryIndex].name = originalCategory.name;
                setWorkSpaces(workspacesCopy);
                
                // Invalidate cache after rollback for consistency
                await invalidateWorkspacesCache();
            }
            
            throw error;
        }
    };

    useEffect(() => {
        if (workspaces.length === 0) return;
        const selectedWorkspace = getWorkspace(selected);
        if (selectedWorkspace == null) return;
        setCategories(selectedWorkspace.categories);
    }, [selected, workspaces]);

    useEffect(() => {
        setSelectedCategory({ label: "", id: "", special: false });
    }, [selected]);

    // Load recent workspaces on mount
    useEffect(() => {
        if (user?._id) {
            loadRecentWorkspaces();
        }
    }, [user?._id]);

    return (
        <TaskContext.Provider
            value={{
                workspaces,
                setWorkSpaces,
                getWorkspace,
                fetchWorkspaces,
                selected,
                setSelected: handleSetSelected,
                categories,
                addToCategory,
                updateTask,
                addToWorkspace,
                addWorkspace,
                removeFromCategory,
                removeFromWorkspace,
                removeWorkspace,
                restoreWorkspace,
                renameWorkspace,
                renameCategory,
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
                windowTasks,
                recentWorkspaces,
                getRecentWorkspaces,
                clearRecentWorkspaces,
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