import { useAuth } from "@/hooks/useAuth";
import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useCallback,
    useRef,
    useSyncExternalStore,
    startTransition,
} from "react";
import { createContext, useState, useContext } from "react";
import { Task, Workspace, Categories, BlueprintWorkspace } from "../api/types";
import { getUserTemplatesAPI, moveTaskAPI } from "@/api/task";
import { findTaskIndex, moveTaskInWorkspaces } from "@/utils/moveTask";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { computePhantomTasks } from "@/utils/phantomTasks";
import { fetchUserWorkspaces } from "@/api/workspace";
import { renameWorkspace as renameWorkspaceAPI, renameCategory as renameCategoryAPI, updateWorkspaceMeta } from "@/api/category";
import { addDays, startOfDay } from "date-fns";
import { getUserSubscribedBlueprints } from "@/api/blueprint";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNetStatus, isOffline, subscribeNetStatus } from "@/utils/netStatus";
import { createLogger } from "@/utils/logger";
import { InteractionManager } from "react-native";
import {
    decorateTask,
    getTreeIndexes,
    updateCategories,
    updateCategoryById,
    updateWorkspaceByName,
} from "@/utils/workspaceTree";
import {
    TodayTasksWidgetUpdater as TodayTasksWidget,
    WorkspaceSnapshotWidgetUpdater as WorkspaceSnapshotWidget,
    LockScreenCircularWidgetUpdater as LockScreenCircularWidget,
    LockScreenRectangularWidgetUpdater as LockScreenRectangularWidget,
} from "@/widgets/widgetUpdaters";

const logger = createLogger('TasksContext');

export type TasksState = {
    workspaces: Workspace[];
    selected: string;
    categories: Categories[];
    fetchingWorkspaces: boolean;
    /** When the workspace last came from the server, or null if never. */
    lastSyncedAt: number | null;
    /** True when we're showing cached data that may be out of date with the server. */
    isShowingStaleData: boolean;
    showConfetti: boolean;
    task: Task | null;
    unnestedTasks: Task[];
    startTodayTasks: Task[];
    dueTodayTasks: Task[];
    pastStartTasks: Task[];
    pastDueTasks: Task[];
    futureTasks: Task[];
    allTasks: Task[];
    windowTasks: Task[];
    recentWorkspaces: string[];
};

export type TaskActions = {
    setWorkSpaces: (workspaces: Workspace[]) => void;
    getWorkspace: (name: string) => Workspace | undefined;
    fetchWorkspaces: (forceRefresh?: boolean) => Promise<void>;
    setSelected: (selected: string) => void;
    /** Latest selection, including a setSelected not yet published to useTasksSelector subscribers. */
    getSelected: () => string;
    addToCategory: (categoryId: string, task: Task) => void;
    addToWorkspace: (name: string, category: Categories) => void;
    addWorkspace: (name: string, category: Categories, icon?: string | null, color?: string | null) => void;
    updateTask: (categoryId: string, taskId: string, updates: Partial<Task>) => void;
    moveTask: (sourceCategoryId: string, taskId: string, targetCategoryId: string) => Promise<void>;
    removeFromCategory: (categoryId: string, taskId: string) => void;
    removeFromWorkspace: (name: string, categoryId: string) => void;
    removeWorkspace: (name: string) => void;
    restoreWorkspace: (workspace: Workspace) => void;
    renameWorkspace: (oldName: string, newName: string) => Promise<void>;
    renameCategory: (categoryId: string, newName: string) => Promise<void>;
    getCategoriesByTag: (tag: string) => { workspaceName: string; category: Categories }[];
    updateCategoryTags: (categoryId: string, tags: string[]) => void;
    updateWorkspaceIconColor: (name: string, icon?: string | null, color?: string | null) => Promise<void>;
    setShowConfetti: (showConfetti: boolean) => void;
    setTask: (task: Task | null) => void;
    getTaskById: (categoryId: string, taskId: string) => Task | null;
    doesWorkspaceExist: (name: string) => boolean;
    getRecentWorkspaces: () => string[];
    clearRecentWorkspaces: () => Promise<void>;
};

type TaskContextType = TasksState & TaskActions;

export type { Task };

type TasksStore = {
    state: TasksState;
    listeners: Set<() => void>;
    subscribe: (listener: () => void) => () => void;
    getState: () => TasksState;
};

const TaskContext = createContext<TaskContextType>({} as TaskContextType);
const TasksStoreContext = createContext<{ store: TasksStore; actions: TaskActions } | null>(null);

const MAX_RECENT_WORKSPACES = 6;
/** Cached data younger than this is served without a background refresh. */
const REVALIDATE_AFTER = 30 * 1000;
const CACHE_WRITE_DEBOUNCE = 1500;
const RECENTS_WRITE_DEBOUNCE = 500;

const workspacesCacheKey = (userId: string | undefined) => `workspaces_cache_${userId || 'default'}`;
const recentWorkspacesKey = (userId: string | undefined) => `recent_workspaces_${userId || 'default'}`;

type CachedWorkspaces = { data: Workspace[]; timestamp: number; templates?: any[] };

function createStore(initial: TasksState): TasksStore {
    const store: TasksStore = {
        state: initial,
        listeners: new Set(),
        subscribe: (listener) => {
            store.listeners.add(listener);
            return () => store.listeners.delete(listener);
        },
        getState: () => store.state,
    };
    return store;
}

export function shallowEqual(a: any, b: any): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!Object.is(a[i], b[i])) return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) return false;
    }
    return true;
}

function sameItems<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Pure lookups shared by the stable actions (latest committed state) and the
// legacy useTasks() value (render-time state).
function findWorkspace(workspaces: Workspace[], name: string): Workspace | undefined {
    return getTreeIndexes(workspaces).workspaceByName.get(name);
}

function findTask(workspaces: Workspace[], categoryId: string, taskId: string): Task | null {
    const indexes = getTreeIndexes(workspaces);
    const loc = indexes.taskById.get(taskId);
    if (loc && loc.category.id === categoryId) return decorateTask(loc.task, loc.category, loc.workspace);
    const catLoc = indexes.categoryById.get(categoryId);
    if (!catLoc) return null;
    const task = catLoc.category.tasks.find((t) => t.id === taskId);
    return task ? decorateTask(task, catLoc.category, catLoc.workspace) : null;
}

function findCategoriesByTag(workspaces: Workspace[], tag: string) {
    const target = tag.trim().toLowerCase();
    const matches: { workspaceName: string; category: Categories }[] = [];
    for (const ws of workspaces) {
        for (const category of ws.categories) {
            if ((category.tags ?? []).includes(target)) {
                matches.push({ workspaceName: ws.name, category });
            }
        }
    }
    return matches;
}

type DateBuckets = {
    startTodayTasks: Task[];
    dueTodayTasks: Task[];
    windowTasks: Task[];
    pastStartTasks: Task[];
    pastDueTasks: Task[];
    futureTasks: Task[];
};

// Single pass over the tasks, parsing each date once. Mirrors the old
// isToday/isPast/isFuture(new Date(x)) filters, including invalid dates never
// matching and a null date parsing to the epoch.
function computeDateBuckets(tasks: Task[]): DateBuckets {
    const buckets: DateBuckets = {
        startTodayTasks: [],
        dueTodayTasks: [],
        windowTasks: [],
        pastStartTasks: [],
        pastDueTasks: [],
        futureTasks: [],
    };
    const now = Date.now();
    const todayStart = startOfDay(now).getTime();
    const tomorrowStart = startOfDay(addDays(now, 1)).getTime();
    for (const task of tasks) {
        const start = new Date(task?.startDate as any).getTime();
        const due = new Date(task?.deadline as any).getTime();
        if (start >= todayStart && start < tomorrowStart) buckets.startTodayTasks.push(task);
        if (due >= todayStart && due < tomorrowStart) buckets.dueTodayTasks.push(task);
        if (start <= now && now <= due) buckets.windowTasks.push(task);
        if (start < now) buckets.pastStartTasks.push(task);
        if (due < now) buckets.pastDueTasks.push(task);
        if (due > now) buckets.futureTasks.push(task);
    }
    return buckets;
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId: string | undefined = user?._id || undefined;
    const [rawWorkspaces, setRawWorkspaces] = useState<Workspace[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selected, setSelectedState] = useState<string>("");
    const [fetchingWorkspaces, setFetchingWorkspaces] = useState(false);
    const [lastSyncedAt, setLastSyncedAtState] = useState<number | null>(null);
    const [isShowingStaleData, setIsShowingStaleData] = useState(false);
    const [task, setTask] = useState<Task | null>(null);
    const [recentWorkspaces, setRecentWorkspacesState] = useState<string[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);

    // Write-ahead mirrors: always hold the latest value we've asked React to
    // render, so actions never read a render-time closure.
    const rawRef = useRef<Workspace[]>(rawWorkspaces);
    const templatesRef = useRef<any[]>(templates);
    const selectedRef = useRef(selected);
    const lastSyncedAtRef = useRef<number | null>(lastSyncedAt);
    const recentRef = useRef<string[]>(recentWorkspaces);
    const userIdRef = useRef<string | undefined>(userId);
    userIdRef.current = userId;

    // Whether the in-memory tree was loaded (cache or network) for this user.
    const hydratedRef = useRef(false);
    // Local mutations since the last successful server sync.
    const dirtyRef = useRef(false);
    const hydrateInflightRef = useRef<Promise<boolean> | null>(null);
    const networkInflightRef = useRef<Promise<void> | null>(null);
    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recentsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateRaw = useCallback((fn: (prev: Workspace[]) => Workspace[]) => {
        const prev = rawRef.current;
        const next = fn(prev);
        if (next !== prev) {
            rawRef.current = next;
            setRawWorkspaces(next);
        }
        return next;
    }, []);

    const setTemplatesValue = useCallback((next: any[]) => {
        templatesRef.current = next;
        setTemplates(next);
    }, []);

    const setSelectedValue = useCallback((next: string) => {
        selectedRef.current = next;
        setSelectedState(next);
    }, []);

    const setLastSyncedAt = useCallback((next: number | null) => {
        lastSyncedAtRef.current = next;
        setLastSyncedAtState(next);
    }, []);

    const setRecents = useCallback((next: string[]) => {
        recentRef.current = next;
        setRecentWorkspacesState(next);
    }, []);

    // Upcoming (phantom) categories, reusing the previous per-workspace result
    // when its phantoms didn't change so untouched workspaces keep their refs.
    const phantomCacheRef = useRef(new WeakMap<Workspace, { key: string; templates: any[]; result: Workspace }>());
    const workspaces = useMemo(() => {
        if (templates.length === 0) return rawWorkspaces;
        const phantomMap = computePhantomTasks(templates, rawWorkspaces);
        if (phantomMap.size === 0) return rawWorkspaces;
        const cache = phantomCacheRef.current;
        return rawWorkspaces.map(ws => {
            const upcomingTasks: Task[] = [];
            for (const cat of ws.categories) {
                const phantoms = phantomMap.get(cat.id);
                if (phantoms) upcomingTasks.push(...phantoms);
            }
            if (upcomingTasks.length === 0) return ws;
            const key = upcomingTasks.map(t => t.id).join("|");
            const cached = cache.get(ws);
            if (cached && cached.key === key && cached.templates === templates) return cached.result;
            const upcomingCategory: Categories = {
                id: `upcoming-${ws.name}`,
                name: "Upcoming",
                tasks: upcomingTasks,
                tags: [],
            };
            const result = { ...ws, categories: [...ws.categories, upcomingCategory] };
            cache.set(ws, { key, templates, result });
            return result;
        });
    }, [rawWorkspaces, templates]);

    const unnestedTasks = useMemo(() => {
        const res: Task[] = [];
        for (const workspace of workspaces) {
            for (const category of workspace.categories) {
                for (const task of category.tasks) {
                    if (task.isPhantom) continue;
                    res.push(decorateTask(task, category, workspace));
                }
            }
        }
        res.push(...require("@/__scratch_mockTasks").default); // SCRATCH-MOCK remove
        return res;
    }, [workspaces]);

    const prevBucketsRef = useRef<DateBuckets | null>(null);
    const buckets = useMemo(() => {
        const next = computeDateBuckets(unnestedTasks);
        const prev = prevBucketsRef.current;
        if (prev) {
            for (const key of Object.keys(next) as (keyof DateBuckets)[]) {
                if (sameItems(prev[key], next[key])) next[key] = prev[key];
            }
        }
        prevBucketsRef.current = next;
        return next;
    }, [unnestedTasks]);
    const { startTodayTasks, dueTodayTasks, windowTasks, pastStartTasks, pastDueTasks, futureTasks } = buckets;

    const categories = useMemo(() => {
        if (workspaces.length === 0) return [];
        return findWorkspace(workspaces, selected)?.categories ?? [];
    }, [selected, workspaces]);

    const state = useMemo<TasksState>(() => ({
        workspaces,
        selected,
        categories,
        fetchingWorkspaces,
        lastSyncedAt,
        isShowingStaleData,
        showConfetti,
        task,
        unnestedTasks,
        startTodayTasks,
        dueTodayTasks,
        pastStartTasks,
        pastDueTasks,
        futureTasks,
        allTasks: unnestedTasks,
        windowTasks,
        recentWorkspaces,
    }), [
        workspaces, selected, categories, fetchingWorkspaces, lastSyncedAt, isShowingStaleData,
        showConfetti, task, unnestedTasks, startTodayTasks, dueTodayTasks, pastStartTasks,
        pastDueTasks, futureTasks, windowTasks, recentWorkspaces,
    ]);

    const [store] = useState(() => createStore(state));

    // Publish only committed state; subscribers re-render before paint.
    useLayoutEffect(() => {
        if (store.state === state) return;
        store.state = state;
        store.listeners.forEach((listener) => listener());
    }, [store, state]);

    /** Debounced write-through of the current tree to the disk cache. */
    const schedulePersist = useCallback(() => {
        dirtyRef.current = true;
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        const uid = userIdRef.current;
        persistTimerRef.current = setTimeout(() => {
            persistTimerRef.current = null;
            InteractionManager.runAfterInteractions(() => {
                // Never write a tree that wasn't loaded for this user — it
                // would clobber their real cache with partial data.
                if (!uid || uid !== userIdRef.current || !hydratedRef.current) return;
                const payload: CachedWorkspaces = {
                    data: rawRef.current,
                    timestamp: lastSyncedAtRef.current ?? Date.now(),
                    templates: templatesRef.current,
                };
                AsyncStorage.setItem(workspacesCacheKey(uid), JSON.stringify(payload)).catch((error) =>
                    logger.error("Error writing workspaces cache", error)
                );
            });
        }, CACHE_WRITE_DEBOUNCE);
    }, []);

    /**
     * Load the cached workspace into state regardless of its age. Returns the
     * cache timestamp, or null when there's nothing cached to serve.
     */
    const serveFromCache = useCallback(async (uid: string): Promise<number | null> => {
        try {
            const cached = await AsyncStorage.getItem(workspacesCacheKey(uid));
            if (!cached || uid !== userIdRef.current) return null;

            const { data, timestamp, templates: cachedTemplates } = JSON.parse(cached) as CachedWorkspaces;
            if (!Array.isArray(data)) return null;

            const stale = Date.now() - timestamp >= REVALIDATE_AFTER;
            startTransition(() => {
                updateRaw(() => data);
                if (Array.isArray(cachedTemplates)) setTemplatesValue(cachedTemplates);
                setLastSyncedAt(timestamp);
                setIsShowingStaleData(stale);
            });
            hydratedRef.current = true;
            return timestamp;
        } catch (error) {
            logger.error("Error reading workspaces cache", error);
            return null;
        }
    }, [updateRaw, setTemplatesValue, setLastSyncedAt]);

    const hydrateFromCache = useCallback((uid: string): Promise<boolean> => {
        if (!hydrateInflightRef.current) {
            hydrateInflightRef.current = serveFromCache(uid)
                .then((timestamp) => timestamp !== null)
                .finally(() => { hydrateInflightRef.current = null; });
        }
        return hydrateInflightRef.current;
    }, [serveFromCache]);

    /** One shared network refresh at a time. */
    const refreshFromNetwork = useCallback((uid: string): Promise<void> => {
        if (networkInflightRef.current) return networkInflightRef.current;

        const run = async () => {
            setFetchingWorkspaces(true);
            try {
                const [data, userTemplates, subscribedBlueprints] = await Promise.all([
                    fetchUserWorkspaces(uid),
                    getUserTemplatesAPI().catch(err => {
                        logger.error("Failed to fetch templates", err);
                        return [];
                    }),
                    getUserSubscribedBlueprints(),
                ]);
                if (uid !== userIdRef.current) return;

                const blueprintWorkspaces: BlueprintWorkspace[] = subscribedBlueprints.map((blueprint) => ({
                    name: blueprint.name,
                    categories: [],
                    blueprintDetails: blueprint,
                    isBlueprint: true,
                }));

                const allWorkspaces = [...data, ...blueprintWorkspaces];
                const syncedAt = Date.now();
                startTransition(() => {
                    updateRaw(() => allWorkspaces);
                    setTemplatesValue(userTemplates);
                    setLastSyncedAt(syncedAt);
                    setIsShowingStaleData(false);
                });
                hydratedRef.current = true;
                dirtyRef.current = false;
                if (persistTimerRef.current) {
                    clearTimeout(persistTimerRef.current);
                    persistTimerRef.current = null;
                }

                try {
                    await AsyncStorage.setItem(workspacesCacheKey(uid), JSON.stringify({
                        data: allWorkspaces,
                        timestamp: syncedAt,
                        templates: userTemplates,
                    }));
                } catch (error) {
                    logger.error("Error caching workspaces", error);
                }
            } catch (error) {
                logger.error("Error fetching workspaces", error);

                // Couldn't reach the server. Keep what's in memory, or fall
                // back to whatever is on disk regardless of age — a stale
                // workspace is far better than an empty screen. Only rethrow if
                // we have nothing at all to show.
                if (hydratedRef.current) {
                    setIsShowingStaleData(true);
                    return;
                }
                const served = await serveFromCache(uid);
                if (served !== null) {
                    setIsShowingStaleData(true);
                    logger.warn("Serving stale workspaces after a failed fetch");
                    return;
                }
                throw error;
            } finally {
                setFetchingWorkspaces(false);
            }
        };

        const promise = run().finally(() => {
            if (networkInflightRef.current === promise) networkInflightRef.current = null;
        });
        networkInflightRef.current = promise;
        return promise;
    }, [updateRaw, setTemplatesValue, setLastSyncedAt, serveFromCache]);

    /**
     * Stale-while-revalidate load. Without `forceRefresh`: hydrate from disk if
     * we haven't yet (refreshing in the background when the cache is old), and
     * otherwise only hit the network when the data is old or has local edits.
     * Concurrent calls share one request. `forceRefresh` always refetches.
     */
    const fetchWorkspaces = useCallback(async (forceRefresh: boolean = false) => {
        const uid = userIdRef.current;
        if (!uid) return;

        // No point spending the request timeout on a network we already know
        // is down — serve what we have.
        if (isOffline(getNetStatus())) {
            if (hydratedRef.current) {
                setIsShowingStaleData(true);
                return;
            }
            if (await hydrateFromCache(uid)) {
                setIsShowingStaleData(true);
                return;
            }
        }

        if (forceRefresh) return refreshFromNetwork(uid);

        if (networkInflightRef.current) return networkInflightRef.current;

        if (!hydratedRef.current) {
            const served = await hydrateFromCache(uid);
            if (uid !== userIdRef.current) return;
            if (served) {
                const age = Date.now() - (lastSyncedAtRef.current ?? 0);
                if (age >= REVALIDATE_AFTER) {
                    refreshFromNetwork(uid).catch((error) =>
                        logger.error("Background workspace refresh failed", error)
                    );
                }
                return;
            }
            return refreshFromNetwork(uid);
        }

        const age = Date.now() - (lastSyncedAtRef.current ?? 0);
        if (dirtyRef.current || age >= REVALIDATE_AFTER) {
            return refreshFromNetwork(uid);
        }
    }, [hydrateFromCache, refreshFromNetwork]);

    // Start loading as soon as we know who the user is, rather than waiting
    // for a screen to ask.
    useEffect(() => {
        hydratedRef.current = false;
        dirtyRef.current = false;
        hydrateInflightRef.current = null;
        networkInflightRef.current = null;
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
        }
        if (!userId) return;
        fetchWorkspaces().catch((error) => logger.error("Initial workspace load failed", error));
    }, [userId, fetchWorkspaces]);

    useEffect(() => () => {
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        if (recentsTimerRef.current) clearTimeout(recentsTimerRef.current);
    }, []);

    const setWorkSpaces = useCallback((next: Workspace[]) => {
        updateRaw(() => next);
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const addWorkspace = useCallback(async (name: string, category: Categories, icon?: string | null, color?: string | null) => {
        const newWorkspace: Workspace = {
            name,
            categories: [category],
            isBlueprint: false,
            icon: icon ?? null,
            color: color ?? null,
        };
        updateRaw(prev => [...prev, newWorkspace]);
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const addToCategory = useCallback((categoryId: string, task: Task) => {
        updateRaw(prev => updateCategoryById(prev, categoryId, category => ({
            ...category,
            tasks: [...(category.tasks || []), { ...task, categoryName: category.name }],
        })));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const updateTask = useCallback((categoryId: string, taskId: string, updates: Partial<Task>) => {
        updateRaw(prev => updateCategoryById(prev, categoryId, category => {
            const index = category.tasks.findIndex(t => t.id === taskId);
            if (index === -1) return category;
            const tasks = category.tasks.slice();
            tasks[index] = { ...tasks[index], ...updates, categoryName: category.name };
            return { ...category, tasks };
        }));

        setTask(prev => {
            if (prev && prev.id === taskId) {
                return { ...prev, ...updates };
            }
            return prev;
        });

        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const moveTask = useCallback(
        async (sourceCategoryId: string, taskId: string, targetCategoryId: string) => {
            if (sourceCategoryId === targetCategoryId) return;

            let originalIndex = -1;
            updateRaw((prev) => {
                originalIndex = findTaskIndex(prev, sourceCategoryId, taskId);
                return moveTaskInWorkspaces(prev, sourceCategoryId, taskId, targetCategoryId);
            });
            if (originalIndex === -1) return;
            schedulePersist();

            try {
                await moveTaskAPI(sourceCategoryId, taskId, targetCategoryId);
            } catch (error) {
                logger.error("Failed to move task, rolling back", error);
                // Undo just this move (keeping any edits made to the task or
                // other categories in the meantime) rather than restoring a
                // whole-tree snapshot.
                updateRaw((prev) =>
                    moveTaskInWorkspaces(prev, targetCategoryId, taskId, sourceCategoryId, originalIndex)
                );
                schedulePersist();
                showToastable({
                    title: "Couldn't move task",
                    status: "danger",
                    position: "top",
                    message: "Something went wrong. Please try again.",
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        },
        [updateRaw, schedulePersist]
    );

    const addToWorkspace = useCallback((name: string, category: Categories) => {
        updateRaw(prev => updateWorkspaceByName(prev, name, workspace => ({
            ...workspace,
            categories: [...workspace.categories, { ...category, tasks: category.tasks ?? [], tags: category.tags ?? [] }],
        })));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const removeFromCategory = useCallback(async (categoryId: string, taskId: string) => {
        updateRaw(prev => updateCategoryById(prev, categoryId, category => {
            if (!category.tasks.some(t => t.id === taskId)) return category;
            return { ...category, tasks: category.tasks.filter(t => t.id !== taskId) };
        }));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const removeFromWorkspace = useCallback(async (name: string, categoryId: string) => {
        updateRaw(prev => updateWorkspaceByName(prev, name, workspace => {
            if (!workspace.categories.some(c => c.id === categoryId)) return workspace;
            return { ...workspace, categories: workspace.categories.filter(c => c.id !== categoryId) };
        }));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const removeWorkspace = useCallback((name: string) => {
        const filtered = updateRaw(prev => prev.filter(workspace => workspace.name !== name));
        if (selectedRef.current === name) {
            setSelectedValue(filtered.length > 0 ? filtered[0].name : "");
        }
        schedulePersist();
    }, [updateRaw, setSelectedValue, schedulePersist]);

    const restoreWorkspace = useCallback(async (workspace: Workspace) => {
        updateRaw(prev => [...prev, workspace]);
        schedulePersist();
        if (selectedRef.current === "") {
            setSelectedValue(workspace.name);
        }
    }, [updateRaw, setSelectedValue, schedulePersist]);

    const updateWorkspaceIconColor = useCallback(async (name: string, icon?: string | null, color?: string | null) => {
        await updateWorkspaceMeta(name, icon, color);
        updateRaw(prev => updateWorkspaceByName(prev, name, w => ({
            ...w,
            icon: icon !== undefined ? icon : w.icon,
            color: color !== undefined ? color : w.color,
        })));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const renameWorkspace = useCallback(async (oldName: string, newName: string) => {
        updateRaw(prev => updateWorkspaceByName(prev, oldName, w => ({ ...w, name: newName })));
        if (selectedRef.current === oldName) {
            setSelectedValue(newName);
        }
        schedulePersist();

        try {
            await renameWorkspaceAPI(oldName, newName);
        } catch (error) {
            logger.error("Error renaming workspace", error);
            updateRaw(prev => updateWorkspaceByName(prev, newName, w => ({ ...w, name: oldName })));
            if (selectedRef.current === newName) {
                setSelectedValue(oldName);
            }
            schedulePersist();
            throw error;
        }
    }, [updateRaw, setSelectedValue, schedulePersist]);

    const renameCategory = useCallback(async (categoryId: string, newName: string) => {
        let originalName: string | null = null;

        updateRaw(prev => updateCategoryById(prev, categoryId, category => {
            originalName = category.name;
            return { ...category, name: newName };
        }));
        schedulePersist();

        try {
            await renameCategoryAPI(categoryId, newName);
        } catch (error) {
            logger.error("Error renaming category", error);
            if (originalName !== null) {
                const rollbackName = originalName;
                updateRaw(prev => updateCategoryById(prev, categoryId, category => ({ ...category, name: rollbackName })));
                schedulePersist();
            }
            throw error;
        }
    }, [updateRaw, schedulePersist]);

    const updateCategoryTags = useCallback((categoryId: string, tags: string[]) => {
        updateRaw(prev => updateCategoryById(prev, categoryId, c => ({ ...c, tags })));
        schedulePersist();
    }, [updateRaw, schedulePersist]);

    const handleSetSelected = useCallback((workspaceName: string) => {
        setSelectedValue(workspaceName);
        if (!workspaceName || workspaceName.trim() === '') return;
        const prev = recentRef.current;
        if (prev[0] === workspaceName) return;
        const updated = [workspaceName, ...prev.filter(n => n !== workspaceName)].slice(0, MAX_RECENT_WORKSPACES);
        setRecents(updated);

        if (recentsTimerRef.current) clearTimeout(recentsTimerRef.current);
        const key = recentWorkspacesKey(userIdRef.current);
        recentsTimerRef.current = setTimeout(() => {
            recentsTimerRef.current = null;
            AsyncStorage.setItem(key, JSON.stringify(recentRef.current)).catch(
                error => logger.error('Error saving recent workspaces', error)
            );
        }, RECENTS_WRITE_DEBOUNCE);
    }, [setSelectedValue, setRecents]);

    const clearRecentWorkspaces = useCallback(async () => {
        if (recentsTimerRef.current) {
            clearTimeout(recentsTimerRef.current);
            recentsTimerRef.current = null;
        }
        try {
            await AsyncStorage.removeItem(recentWorkspacesKey(userIdRef.current));
            setRecents([]);
        } catch (error) {
            logger.error('Error clearing recent workspaces', error);
        }
    }, [setRecents]);

    useEffect(() => {
        let cancelled = false;
        if (userId) {
            AsyncStorage.getItem(recentWorkspacesKey(userId)).then(stored => {
                if (!cancelled && stored) {
                    setRecents(JSON.parse(stored));
                }
            }).catch(error => logger.error('Error loading recent workspaces', error));
        }
        return () => { cancelled = true; };
    }, [userId, setRecents]);

    // The workspace isn't a react-query resource, so `refetchOnReconnect` does
    // nothing for it. Refetch ourselves when connectivity returns, otherwise a
    // user who was offline keeps staring at stale cached data until they
    // manually pull to refresh.
    useEffect(() => {
        if (!userId) return;

        let wasOffline = isOffline(getNetStatus());
        return subscribeNetStatus((status) => {
            const nowOffline = isOffline(status);
            if (wasOffline && !nowOffline) {
                logger.debug("Back online, refreshing workspaces");
                fetchWorkspaces(true).catch((error) =>
                    logger.error("Reconnect refresh failed", error)
                );
            }
            wasOffline = nowOffline;
        });
    }, [userId, fetchWorkspaces]);

    // Sync Today's Tasks widget and lock screen circular widget
    useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            // Everything in unnestedTasks is open (completed tasks move to a
            // separate collection); `active` now means in-progress, so don't
            // filter the list on it — show all open tasks.
            const incompleteTasks = unnestedTasks;
            const completedCount = unnestedTasks.filter(t => !t.active).length;
            const totalCount = unnestedTasks.length;

            const taskTitles = incompleteTasks.slice(0, 3).map(t => t.content);

            const groupMap = new Map<string, string[]>();
            incompleteTasks.forEach(t => {
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
                .filter(t => t.deadline)
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
    }, [unnestedTasks, dueTodayTasks]);

    // Sync Workspace Snapshot widget
    useEffect(() => {
        if (workspaces.length === 0) return;
        const handle = InteractionManager.runAfterInteractions(() => {
            const firstWorkspace = workspaces.find(w => !w.isBlueprint) || workspaces[0];
            if (!firstWorkspace) return;
            const allTasks = firstWorkspace.categories.flatMap(c => c.tasks);
            const pendingCount = allTasks.length;
            const topTasks = allTasks.slice(0, 3).map(t => t.content);

            WorkspaceSnapshotWidget.updateSnapshot({
                workspaceName: firstWorkspace.name,
                workspaceColor: firstWorkspace.color || '',
                pendingCount,
                topTasks,
            });
        });
        return () => handle.cancel();
    }, [workspaces]);

    // Every function here is stable; getters read the latest committed state.
    const actions = useMemo<TaskActions>(() => ({
        setWorkSpaces,
        getWorkspace: (name) => findWorkspace(store.state.workspaces, name),
        fetchWorkspaces,
        setSelected: handleSetSelected,
        getSelected: () => selectedRef.current,
        addToCategory,
        addToWorkspace,
        addWorkspace,
        updateTask,
        moveTask,
        removeFromCategory,
        removeFromWorkspace,
        removeWorkspace,
        restoreWorkspace,
        renameWorkspace,
        renameCategory,
        getCategoriesByTag: (tag) => findCategoriesByTag(store.state.workspaces, tag),
        updateCategoryTags,
        updateWorkspaceIconColor,
        setShowConfetti,
        setTask,
        getTaskById: (categoryId, taskId) => findTask(store.state.workspaces, categoryId, taskId),
        doesWorkspaceExist: (name) => findWorkspace(store.state.workspaces, name) !== undefined,
        getRecentWorkspaces: () => store.state.recentWorkspaces,
        clearRecentWorkspaces,
    }), [
        store, setWorkSpaces, fetchWorkspaces, handleSetSelected, addToCategory, addToWorkspace,
        addWorkspace, updateTask, moveTask, removeFromCategory, removeFromWorkspace, removeWorkspace,
        restoreWorkspace, renameWorkspace, renameCategory, updateCategoryTags, updateWorkspaceIconColor,
        clearRecentWorkspaces,
    ]);

    const storeValue = useMemo(() => ({ store, actions }), [store, actions]);

    // Legacy value: getters close over render-time state (and change identity
    // with it) exactly as before, so render-phase calls stay in sync.
    const value = useMemo<TaskContextType>(() => ({
        ...state,
        ...actions,
        getWorkspace: (name: string) => findWorkspace(workspaces, name),
        getCategoriesByTag: (tag: string) => findCategoriesByTag(workspaces, tag),
        getTaskById: (categoryId: string, taskId: string) => findTask(workspaces, categoryId, taskId),
        doesWorkspaceExist: (name: string) => findWorkspace(workspaces, name) !== undefined,
        getRecentWorkspaces: () => recentWorkspaces,
    }), [state, actions, workspaces, recentWorkspaces]);

    return (
        <TasksStoreContext.Provider value={storeValue}>
            <TaskContext.Provider value={value}>
                {children}
            </TaskContext.Provider>
        </TasksStoreContext.Provider>
    );
}

function useTasksStoreContext() {
    const context = useContext(TasksStoreContext);
    if (!context) {
        throw new Error("Tasks hooks must be used within a TasksProvider");
    }
    return context;
}

/** Stable action functions; never causes a re-render. */
export function useTaskActions(): TaskActions {
    return useTasksStoreContext().actions;
}

/**
 * Subscribe to a slice of the tasks state. Re-renders only when the selected
 * value changes according to `isEqual` (default Object.is).
 */
export function useTasksSelector<T>(
    selector: (s: TasksState) => T,
    isEqual: (a: T, b: T) => boolean = Object.is
): T {
    const { store } = useTasksStoreContext();
    const cacheRef = useRef<{ state: TasksState; selector: (s: TasksState) => T; value: T } | null>(null);

    const getSnapshot = useCallback(() => {
        const current = store.state;
        const cache = cacheRef.current;
        if (cache && cache.state === current && cache.selector === selector) return cache.value;
        const next = selector(current);
        if (cache && isEqual(cache.value, next)) {
            cacheRef.current = { state: current, selector, value: cache.value };
            return cache.value;
        }
        cacheRef.current = { state: current, selector, value: next };
        return next;
    }, [store, selector, isEqual]);

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error("useTasks must be used within a TasksProvider");
    }
    return context;
};
