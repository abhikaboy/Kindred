import { useSyncExternalStore } from "react";
import type { Task } from "@/api/types";
import type { PlanSize } from "@/api/plan";

// App-wide handle for the Build a plan sheet, so any surface (the waiting chip,
// a passed-plan card, Clear the fog) can open it without prop drilling.

export type PlanWhen = "tonight" | "tomorrow" | "weekend";
export type PlanSheetRequest = { task: Task; size?: PlanSize; when?: PlanWhen };

let current: PlanSheetRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const openPlanSheet = (req: PlanSheetRequest) => {
    current = req;
    emit();
};

export const closePlanSheet = () => {
    current = null;
    emit();
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export const usePlanSheet = () => useSyncExternalStore(subscribe, () => current);
