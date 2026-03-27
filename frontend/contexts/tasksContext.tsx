import { useAuth } from "@/hooks/useAuth";
import React, { useEffect, useMemo, useCallback, startTransition } from "react";
import { createContext, useState, useContext } from "react";
import { Task, Workspace, Categories, BlueprintWorkspace } from "../api/types";
import { getUserTemplatesAPI } from "@/api/task";
import { computePhantomTasks } from "@/utils/phantomTasks";
import { fetchUserWorkspaces, createWorkspace } from "@/api/workspace";
import { renameWorkspace as renameWorkspaceAPI, renameCategory as renameCategoryAPI, updateWorkspaceMeta } from "@/api/category";
import { isFuture, isPast, isToday } from "date-fns";
import { getUserSubscribedBlueprints } from "@/api/blueprint";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLogger } from "@/utils/logger";
import { InteractionManager } from "react-native";
import {
    TodayTasksWidgetUpdater as TodayTasksWidget,
    WorkspaceSnapshotWidgetUpdater as WorkspaceSnapshotWidget,
    LockScreenCircularWidgetUpdater as LockScreenCircularWidget,
    LockScreenRectangularWidgetUpdater as LockScreenRectangularWidget,
} from "@/widgets/widgetUpdaters";

const logger = createLogger('TasksContext');

const TaskContext = createContext<TaskContextType>({} as TaskContextType);

type TaskContextType = {
    workspaces: Workspace[];
    setWorkSpaces: (workspaces: Workspace[]) => void;
    getWorkspace: (name: string) => Workspace | undefined;
    fetchWorkspaces: (forceRefresh?: boolean) => Promise<void>;
    selected: string;
    setSelected: (selected: string) => void;
    categories: Categories[];
    addToCategory: (categoryId: string, task: Task) => void;
    addToWorkspace: (name: string, category: Categories) => void;
    addWorkspace: (name: string, category: Categories, icon?: string | null, color?: string | null) => void;
    updateTask: (categoryId: string, taskId: string, updates: Partial<Task>) => void;
    removeFromCategory: (categoryId: string, taskId: string) => void;
    removeFromWorkspace: (name: string, categoryId: string) => void;
    removeWorkspace: (name: string) => void;
    restoreWorkspace: (workspace: Workspace) => void;
    renameWorkspace: (oldName: string, newName: string) => Promise<void>;
    renameCategory: (categoryId: string, newName: string) => Promise<void>;
    updateWorkspaceIconColor: (name: string, icon?: string | null, color?: string | null) => Promise<void>;
    fetchingWorkspaces: boolean;

    setCreateCategory: (Option: Option) => void;
    selectedCategory: Option;
    showConfetti: boolean;
    setShowConfetti: (showConfetti: boolean) => void;

    task: Task | null;
    setTask: (task: Task | null) => void;
    getTaskById: (categoryId: string, taskId: string) => Task | null;
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
    const [rawWorkspaces, setRawWorkspaces] = useState<Workspace[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<Option>({ label: "", id: "", special: false });
    const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false);
    const [task, setTask] = useState<Task | null>(null);
    const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);

    const RECENT_WORKSPACES_KEY = `recent_workspaces_${user?._id || 'default'}`;
    const MAX_RECENT_WORKSPACES = 6;
    const WORKSPACES_CACHE_KEY = `workspaces_cache_${user?._id || 'default'}`;
    const CACHE_DURATION = 5 * 60 * 1000;

    const workspaces = useMemo(() => {
        if (templates.length === 0) return rawWorkspaces;
        const phantomMap = computePhantomTasks(templates, rawWorkspaces);
        if (phantomMap.size === 0) return rawWorkspaces;
        return rawWorkspaces.map(ws => {
            const upcomingTasks: Task[] = [];
            for (const cat of ws.categories) {
                const phantoms = phantomMap.get(cat.id);
                if (phantoms) upcomingTasks.push(...phantoms);
            }
            if (upcomingTasks.length === 0) return ws;
            const upcomingCategory: Categories = {
                id: `upcoming-${ws.name}`,
                name: "Upcoming",
                tasks: upcomingTasks,
            };
            return { ...ws, categories: [...ws.categories, upcomingCategory] };
        });
    }, [rawWorkspaces, templates]);

    const unnestedTasks = useMemo(() => {
        const res: Task[] = [];
        for (const workspace of workspaces) {
            for (const category of workspace.categories) {
                for (const task of category.tasks) {
                    if (task.active === false || task.isPhantom) continue;
                    res.push({
                        ...task,
                        categoryID: category.id,
                        categoryName: category.name,
                        workspaceName: workspace.name,
                    });
                }
            }
        }
        return res;
    }, [workspaces]);

    const startTodayTasks = useMemo(() => {
        return unnestedTasks.filter((task) => isToday(new Date(task?.startDate)));
    }, [unnestedTasks]);

    const dueTodayTasks = useMemo(() => {
        return unnestedTasks.filter((task) => isToday(new Date(task?.deadline)));
    }, [unnestedTasks]);

    const windowTasks = useMemo(() => {
        const today = new Date();
        return unnestedTasks.filter((task) => {
            const startDate = new Date(task?.startDate);
            const deadline = new Date(task?.deadline);
            return startDate <= today && today <= deadline;
        });
    }, [unnestedTasks]);

    const pastStartTasks = useMemo(() => {
        return unnestedTasks.filter((task) => isPast(new Date(task?.startDate)));
    }, [unnestedTasks]);

    const pastDueTasks = useMemo(() => {
        return unnestedTasks.filter((task) => isPast(new Date(task?.deadline)));
    }, [unnestedTasks]);

    const futureTasks = useMemo(() => {
        return unnestedTasks.filter((task) => isFuture(new Date(task?.deadline)));
    }, [unnestedTasks]);

    const categories = useMemo(() => {
        if (workspaces.length === 0) return [];
        const selectedWorkspace = workspaces.find((ws) => ws.name === selected);
        return selectedWorkspace?.categories ?? [];
    }, [selected, workspaces]);

    const invalidateWorkspacesCache = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(WORKSPACES_CACHE_KEY);
        } catch (error) {
            logger.error("Error invalidating workspaces cache", error);
        }
    }, [WORKSPACES_CACHE_KEY]);

    const setCreateCategory = useCallback((option: Option) => {
        if (option.id === "" || option.label === "") return;
        setSelectedCategory(option);
    }, []);

    const getWorkspace = useCallback((name: string): Workspace | undefined => {
        return workspaces.find((workspace) => workspace.name === name);
    }, [workspaces]);

    const fetchWorkspaces = useCallback(async (forceRefresh: boolean = false) => {
        if (!user?._id) return;

        if (!forceRefresh) {
            try {
                const cached = await AsyncStorage.getItem(WORKSPACES_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached) as {
                        data: Workspace[];
                        timestamp: number;
                        templates?: any[];
                    };
                    const { data: cachedData, timestamp, templates: cachedTemplates } = parsed;
                    const now = Date.now();
                    if ((now - timestamp) < CACHE_DURATION) {
                        startTransition(() => {
                            setRawWorkspaces(cachedData);
                            if (Array.isArray(cachedTemplates)) {
                                setTemplates(cachedTemplates);
                            }
                        });
                        return;
                    }
                }
            } catch (error) {
                logger.error("Error reading workspaces cache", error);
            }
        }

        setFetchingWorkspaces(true);
        try {
            const [data, userTemplates] = await Promise.all([
                fetchUserWorkspaces(user._id),
                getUserTemplatesAPI().catch(err => {
                    logger.error("Failed to fetch templates", err);
                    return [];
                }),
            ]);
            const subscribedBlueprints = await getUserSubscribedBlueprints();
            const blueprintWorkspaces: BlueprintWorkspace[] = subscribedBlueprints.map((blueprint) => ({
                name: blueprint.name,
                categories: [],
                blueprintDetails: blueprint,
                isBlueprint: true,
            }));

            const allWorkspaces = [...data, ...blueprintWorkspaces];
            console.log("[tasksContext] fetched templates:", userTemplates.length, "sample:", JSON.stringify(userTemplates[0], null, 2));
            startTransition(() => {
                setRawWorkspaces(allWorkspaces);
                setTemplates(userTemplates);
            });

            try {
                await AsyncStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify({
                    data: allWorkspaces,
                    timestamp: Date.now(),
                    templates: userTemplates,
                }));
            } catch (error) {
                logger.error("Error caching workspaces", error);
            }
        } catch (error) {
            logger.error("Error fetching workspaces", error);
            throw error;
        } finally {
            setFetchingWorkspaces(false);
        }
    }, [user?._id, WORKSPACES_CACHE_KEY, CACHE_DURATION]);

    const addWorkspace = useCallback(async (name: string, category: Categories, icon?: string | null, color?: string | null) => {
        const newWorkspace: Workspace = {
            name,
            categories: [category],
            isBlueprint: false,
            icon: icon ?? null,
            color: color ?? null,
        };
        setRawWorkspaces(prev => [...prev, newWorkspace]);
        await invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const addToCategory = useCallback((categoryId: string, task: Task) => {
        setRawWorkspaces(prev => prev.map(workspace => ({
            ...workspace,
            categories: workspace.categories.map(category => {
                if (category.id === categoryId) {
                    return {
                        ...category,
                        tasks: [...category.tasks, { ...task, categoryName: category.name }],
                    };
                }
                return category;
            }),
        })));
        invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const updateTask = useCallback((categoryId: string, taskId: string, updates: Partial<Task>) => {
        setRawWorkspaces(prev => prev.map(workspace => ({
            ...workspace,
            categories: workspace.categories.map(category => {
                if (category.id === categoryId) {
                    return {
                        ...category,
                        tasks: category.tasks.map(t =>
                            t.id === taskId ? { ...t, ...updates, categoryName: category.name } : t
                        ),
                    };
                }
                return category;
            }),
        })));

        setTask(prev => {
            if (prev && prev.id === taskId) {
                return { ...prev, ...updates };
            }
            return prev;
        });

        invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const addToWorkspace = useCallback((name: string, category: Categories) => {
        setRawWorkspaces(prev => prev.map(workspace => {
            if (workspace.name === name) {
                return { ...workspace, categories: [...workspace.categories, category] };
            }
            return workspace;
        }));
        invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const removeFromCategory = useCallback(async (categoryId: string, taskId: string) => {
        setRawWorkspaces(prev => prev.map(workspace => ({
            ...workspace,
            categories: workspace.categories.map(category => {
                if (category.id === categoryId) {
                    return { ...category, tasks: category.tasks.filter(t => t.id !== taskId) };
                }
                return category;
            }),
        })));
        await invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const removeFromWorkspace = useCallback(async (name: string, categoryId: string) => {
        setRawWorkspaces(prev => prev.map(workspace => {
            if (workspace.name === name) {
                return { ...workspace, categories: workspace.categories.filter(c => c.id !== categoryId) };
            }
            return workspace;
        }));
        await invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const removeWorkspace = useCallback((name: string) => {
        setRawWorkspaces(prev => {
            const filtered = prev.filter(workspace => workspace.name !== name);
            if (selected === name) {
                setSelected(filtered.length > 0 ? filtered[0].name : "");
            }
            return filtered;
        });
        invalidateWorkspacesCache();
    }, [selected, invalidateWorkspacesCache]);

    const restoreWorkspace = useCallback(async (workspace: Workspace) => {
        setRawWorkspaces(prev => [...prev, workspace]);
        await invalidateWorkspacesCache();
        if (selected === "") {
            setSelected(workspace.name);
        }
    }, [selected, invalidateWorkspacesCache]);

    const doesWorkspaceExist = useCallback((name: string) => {
        return workspaces.some(workspace => workspace.name === name);
    }, [workspaces]);

    const updateWorkspaceIconColor = useCallback(async (name: string, icon?: string | null, color?: string | null) => {
        await updateWorkspaceMeta(name, icon, color);
        setRawWorkspaces(prev => prev.map(w => {
            if (w.name === name) {
                return {
                    ...w,
                    icon: icon !== undefined ? icon : w.icon,
                    color: color !== undefined ? color : w.color,
                };
            }
            return w;
        }));
        await invalidateWorkspacesCache();
    }, [invalidateWorkspacesCache]);

    const renameWorkspace = useCallback(async (oldName: string, newName: string) => {
        setRawWorkspaces(prev => prev.map(w =>
            w.name === oldName ? { ...w, name: newName } : w
        ));
        if (selected === oldName) {
            setSelected(newName);
        }
        await invalidateWorkspacesCache();

        try {
            await renameWorkspaceAPI(oldName, newName);
            await fetchWorkspaces();
        } catch (error) {
            logger.error("Error renaming workspace", error);
            setRawWorkspaces(prev => prev.map(w =>
                w.name === newName ? { ...w, name: oldName } : w
            ));
            if (selected === newName) {
                setSelected(oldName);
            }
            await invalidateWorkspacesCache();
            throw error;
        }
    }, [selected, invalidateWorkspacesCache, fetchWorkspaces]);

    const renameCategory = useCallback(async (categoryId: string, newName: string) => {
        let originalName: string | null = null;

        setRawWorkspaces(prev => prev.map(workspace => ({
            ...workspace,
            categories: workspace.categories.map(category => {
                if (category.id === categoryId) {
                    originalName = category.name;
                    return { ...category, name: newName };
                }
                return category;
            }),
        })));
        await invalidateWorkspacesCache();

        try {
            await renameCategoryAPI(categoryId, newName);
            await fetchWorkspaces();
        } catch (error) {
            logger.error("Error renaming category", error);
            if (originalName !== null) {
                const rollbackName = originalName;
                setRawWorkspaces(prev => prev.map(workspace => ({
                    ...workspace,
                    categories: workspace.categories.map(category => {
                        if (category.id === categoryId) {
                            return { ...category, name: rollbackName };
                        }
                        return category;
                    }),
                })));
                await invalidateWorkspacesCache();
            }
            throw error;
        }
    }, [invalidateWorkspacesCache, fetchWorkspaces]);

    const handleSetSelected = useCallback((workspaceName: string) => {
        setSelected(workspaceName);
        if (workspaceName && workspaceName.trim() !== '') {
            setRecentWorkspaces(prev => {
                const updated = [workspaceName, ...prev.filter(n => n !== workspaceName)].slice(0, MAX_RECENT_WORKSPACES);
                AsyncStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(updated)).catch(
                    error => logger.error('Error saving recent workspaces', error)
                );
                return updated;
            });
        }
    }, [RECENT_WORKSPACES_KEY, MAX_RECENT_WORKSPACES]);

    const getRecentWorkspaces = useCallback(() => recentWorkspaces, [recentWorkspaces]);

    const clearRecentWorkspaces = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(RECENT_WORKSPACES_KEY);
            setRecentWorkspaces([]);
        } catch (error) {
            logger.error('Error clearing recent workspaces', error);
        }
    }, [RECENT_WORKSPACES_KEY]);

    const getTaskById = useCallback((categoryId: string, taskId: string): Task | null => {
        for (const workspace of workspaces) {
            for (const category of workspace.categories) {
                if (category.id === categoryId) {
                    const task = category.tasks.find((t) => t.id === taskId);
                    if (task) {
                        return {
                            ...task,
                            categoryID: category.id,
                            categoryName: category.name,
                            workspaceName: workspace.name,
                        };
                    }
                }
            }
        }
        return null;
    }, [workspaces]);

    useEffect(() => {
        setSelectedCategory({ label: "", id: "", special: false });
    }, [selected]);

    useEffect(() => {
        let cancelled = false;
        if (user?._id) {
            AsyncStorage.getItem(RECENT_WORKSPACES_KEY).then(stored => {
                if (!cancelled && stored) {
                    setRecentWorkspaces(JSON.parse(stored));
                }
            }).catch(error => logger.error('Error loading recent workspaces', error));
        }
        return () => { cancelled = true; };
    }, [user?._id, RECENT_WORKSPACES_KEY]);

    // Sync Today's Tasks widget and lock screen circular widget
    useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            const allTodayTasks = [
                ...startTodayTasks,
                ...dueTodayTasks.filter(t => !startTodayTasks.some(s => s.id === t.id)),
            ];
            const completedCount = allTodayTasks.filter(t => !t.active).length;
            const totalCount = allTodayTasks.length;

            const taskTitles = allTodayTasks.slice(0, 3).map(t => t.content);

            const groupMap = new Map<string, string[]>();
            allTodayTasks.forEach(t => {
                const ws = t.workspaceName || 'Tasks';
                if (!groupMap.has(ws)) groupMap.set(ws, []);
                groupMap.get(ws)!.push(t.content);
            });
            const workspaceGroups = Array.from(groupMap.entries()).map(([workspaceName, tasks]) => ({
                workspaceName,
                tasks,
            }));

            TodayTasksWidget.updateSnapshot({ completedCount, totalCount, taskTitles, workspaceGroups });
            LockScreenCircularWidget.updateSnapshot({ completedCount, totalCount });

            const nextDue = dueTodayTasks
                .filter(t => t.active !== false && t.deadline)
                .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];

            if (nextDue) {
                const dueDate = new Date(nextDue.deadline!);
                const dueTime = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                LockScreenRectangularWidget.updateSnapshot({ taskTitle: nextDue.content, dueTime });
            } else {
                LockScreenRectangularWidget.updateSnapshot({ taskTitle: '', dueTime: '' });
            }
        });
        return () => handle.cancel();
    }, [startTodayTasks, dueTodayTasks]);

    // Sync Workspace Snapshot widget
    useEffect(() => {
        if (workspaces.length === 0) return;
        const handle = InteractionManager.runAfterInteractions(() => {
            const firstWorkspace = workspaces.find(w => !w.isBlueprint) || workspaces[0];
            if (!firstWorkspace) return;
            const allTasks = firstWorkspace.categories.flatMap(c => c.tasks.filter(t => t.active !== false && !t.isPhantom));
            const pendingCount = allTasks.length;
            const topTasks = allTasks.slice(0, 3).map(t => t.content);

            WorkspaceSnapshotWidget.updateSnapshot({
                workspaceName: firstWorkspace.name,
                workspaceIcon: firstWorkspace.icon || null,
                workspaceColor: firstWorkspace.color || null,
                pendingCount,
                topTasks,
            });
        });
        return () => handle.cancel();
    }, [workspaces]);

    const value = useMemo<TaskContextType>(() => ({
        workspaces,
        setWorkSpaces: setRawWorkspaces,
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
        updateWorkspaceIconColor,
        setCreateCategory,
        selectedCategory,
        showConfetti,
        setShowConfetti,
        task,
        setTask,
        getTaskById,
        doesWorkspaceExist,
        unnestedTasks,
        startTodayTasks,
        dueTodayTasks,
        pastStartTasks,
        pastDueTasks,
        futureTasks,
        allTasks: unnestedTasks,
        fetchingWorkspaces,
        windowTasks,
        recentWorkspaces,
        getRecentWorkspaces,
        clearRecentWorkspaces,
    }), [
        workspaces, getWorkspace, fetchWorkspaces, selected, handleSetSelected,
        categories, addToCategory, updateTask, addToWorkspace, addWorkspace,
        removeFromCategory, removeFromWorkspace, removeWorkspace, restoreWorkspace,
        renameWorkspace, renameCategory, updateWorkspaceIconColor, setCreateCategory,
        selectedCategory, showConfetti, task, getTaskById, doesWorkspaceExist,
        unnestedTasks, startTodayTasks, dueTodayTasks, pastStartTasks, pastDueTasks,
        futureTasks, fetchingWorkspaces, windowTasks, recentWorkspaces,
        getRecentWorkspaces, clearRecentWorkspaces,
    ]);

    return (
        <TaskContext.Provider value={value}>
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
