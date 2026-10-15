import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";
import { hideTask, nextReturnAt, parseHiddenMap, pruneExpired, showTask, type HiddenMap } from "@/utils/stageHidden";

// Tasks the user hid from the home stack for 8 hours. One shared store, so the queue, the cards and the
// "hidden" chip all agree, saved per user so a restart doesn't bring them back early.

const storageKey = (userId: string) => `${userId}-stage-hidden`;

type State = { userId: string | null; map: HiddenMap };
let state: State = { userId: null, map: {} };
const listeners = new Set<() => void>();

const publish = (next: State) => {
    state = next;
    listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};
const getState = () => state;

const persist = (next: State) => {
    if (next.userId) AsyncStorage.setItem(storageKey(next.userId), JSON.stringify(next.map)).catch(() => {});
};

export function hideStageTask(taskId: string) {
    const next = { ...state, map: hideTask(state.map, taskId, Date.now()) };
    publish(next);
    persist(next);
}

export function showStageTask(taskId: string) {
    const next = { ...state, map: showTask(state.map, taskId) };
    publish(next);
    persist(next);
}

export function showAllStageTasks() {
    const next = { ...state, map: {} };
    publish(next);
    persist(next);
}

/** The tasks hidden right now (id -> return time), plus actions. Re-renders when one comes back. */
export function useHiddenStageTasks() {
    const { user } = useAuth();
    const userId = user?._id ?? null;
    const snapshot = useSyncExternalStore(subscribe, getState, getState);
    // Only bumped by the wake-up timer, so `active` keeps a stable reference between wake-ups
    const [nowTick, setTick] = useState(0);

    // Load this user's saved hidden tasks once per user
    useEffect(() => {
        if (!userId || state.userId === userId) return;
        publish({ userId, map: {} });
        AsyncStorage.getItem(storageKey(userId))
            .then((raw) => {
                if (state.userId !== userId) return;
                publish({ userId, map: parseHiddenMap(raw, Date.now()) });
            })
            .catch(() => {});
    }, [userId]);

    const active = useMemo(
        () => (snapshot.userId === userId ? pruneExpired(snapshot.map, Date.now()) : {}),
        // Date.now() is read at compute time; the wake-up timer bumps `nowTick` to force a recompute
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [snapshot, userId, nowTick]
    );

    // Wake up when the soonest hidden task is due back; scheduled off the raw map so it survives renders
    useEffect(() => {
        const at = nextReturnAt(snapshot.map, Date.now());
        if (at === null) return;
        const timer = setTimeout(() => setTick((t) => t + 1), Math.min(at - Date.now() + 500, 2_000_000_000));
        return () => clearTimeout(timer);
    }, [snapshot, userId]);

    const hide = useCallback((id: string) => hideStageTask(id), []);
    const show = useCallback((id: string) => showStageTask(id), []);
    const showAll = useCallback(() => showAllStageTasks(), []);
    return { hidden: active, count: Object.keys(active).length, hide, show, showAll };
}
