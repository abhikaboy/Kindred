import AsyncStorage from "@react-native-async-storage/async-storage";
import { workspaceStateEvents } from "@/utils/workspaceStateEvents";

/**
 * Shared in-memory cache of per-workspace view settings (filters, sort,
 * visibility, grouping). Every workspace's keys are loaded with one
 * getAllKeys + multiGet on first use; after that hooks read synchronously.
 * Writers keep persisting to AsyncStorage and calling workspaceStateEvents.emit,
 * which re-reads that workspace's keys into the cache.
 */

export type WorkspaceFilters = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

export type WorkspaceSortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority" | null;

export type WorkspaceState = {
    filters: WorkspaceFilters | null;
    sort: WorkspaceSortOption;
    sortDirection: "ascending" | "descending" | null;
    isPublic: boolean;
    groupByDay: boolean;
};

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = Object.freeze({
    filters: null,
    sort: null,
    sortDirection: null,
    isPublic: true,
    groupByDay: false,
}) as WorkspaceState;

type Field = "filters" | "sort" | "sortDirection" | "visibility" | "group";

// Longest prefix first: "workspace-sort-" is a prefix of "workspace-sort-direction-".
const PREFIXES: [Field, string][] = [
    ["sortDirection", "workspace-sort-direction-"],
    ["filters", "workspace-filters-"],
    ["sort", "workspace-sort-"],
    ["visibility", "workspace-visibility-"],
    ["group", "workspace-group-"],
];

type Raw = Partial<Record<Field, string | null>>;

const keysFor = (name: string): [Field, string][] => PREFIXES.map(([field, prefix]) => [field, prefix + name]);

const parseRaw = (raw: Raw): WorkspaceState => {
    let filters: WorkspaceFilters | null = null;
    if (raw.filters) {
        try {
            filters = JSON.parse(raw.filters);
        } catch (error) {
            console.error("Error parsing workspace filters:", error);
        }
    }
    return {
        filters,
        sort: raw.sort ? (raw.sort as WorkspaceSortOption) : null,
        sortDirection: raw.sortDirection ? (raw.sortDirection as "ascending" | "descending") : null,
        isPublic: raw.visibility != null ? raw.visibility === "public" : true,
        groupByDay: raw.group === "day",
    };
};

const cache = new Map<string, WorkspaceState>();
const listeners = new Set<() => void>();
let loaded = false;
let loadPromise: Promise<void> | null = null;
let eventsAttached = false;

const notify = () => listeners.forEach((fn) => fn());

const loadAll = (): Promise<void> => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const wanted = allKeys.filter((k) => k.startsWith("workspace-"));
            const pairs = wanted.length > 0 ? await AsyncStorage.multiGet(wanted) : [];
            const rawByName = new Map<string, Raw>();
            for (const [key, value] of pairs) {
                const match = PREFIXES.find(([, prefix]) => key.startsWith(prefix));
                if (!match) continue;
                const [field, prefix] = match;
                const name = key.slice(prefix.length);
                const raw = rawByName.get(name) ?? {};
                raw[field] = value;
                rawByName.set(name, raw);
            }
            rawByName.forEach((raw, name) => cache.set(name, parseRaw(raw)));
        } catch (error) {
            console.error("Error loading workspace state:", error);
        } finally {
            loaded = true;
            notify();
        }
    })();
    return loadPromise;
};

const refresh = async (name: string) => {
    await loadAll();
    try {
        const keys = keysFor(name);
        const pairs = await AsyncStorage.multiGet(keys.map(([, key]) => key));
        const raw: Raw = {};
        pairs.forEach(([, value], i) => {
            raw[keys[i][0]] = value;
        });
        cache.set(name, parseRaw(raw));
        notify();
    } catch (error) {
        console.error("Error loading workspace state:", error);
    }
};

const ensureStarted = () => {
    if (!eventsAttached) {
        eventsAttached = true;
        workspaceStateEvents.subscribe((name) => {
            void refresh(name);
        });
    }
    void loadAll();
};

export const subscribeWorkspaceViewState = (fn: () => void) => {
    ensureStarted();
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

export const getWorkspaceViewState = (name: string): WorkspaceState => cache.get(name) ?? DEFAULT_WORKSPACE_STATE;

export const isWorkspaceViewStateLoaded = () => loaded;

/** Optimistic local update (callers still persist + emit; the emit re-syncs from storage). */
export const setWorkspaceViewState = (name: string, patch: Partial<WorkspaceState>) => {
    cache.set(name, { ...getWorkspaceViewState(name), ...patch });
    notify();
};

/** Test-only: drop all cached state so the next subscriber reloads. */
export const __resetWorkspaceViewStateForTests = () => {
    cache.clear();
    loaded = false;
    loadPromise = null;
};
