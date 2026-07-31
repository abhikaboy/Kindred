import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseRecurrence, parseSchedule, type ParsedRecurrence, type ParsedSchedule } from "@shared/taskSuggest";
import { suggestTaskFieldsAPI, type TaskFieldSuggestion } from "@/api/task";

const MIN_CHARS = 6;
const DEBOUNCE_MS = 600;

const hasAny = (f: TaskFieldSuggestion) =>
    f.categoryId !== undefined || f.priority !== undefined || f.value !== undefined;


/**
 * Two tiers off one input: schedule parsed locally on every keystroke, and
 * category/priority/difficulty fetched once typing settles. Both are additive,
 * so every failure path just yields nothing.
 */
export function useTaskSuggestions(text: string) {
    const trimmed = text.trim();
    const [dismissedFor, setDismissedFor] = useState<string | null>(null);
    const [fuzzy, setFuzzy] = useState<TaskFieldSuggestion | null>(null);

    const dismissed = dismissedFor === trimmed;

    const { schedule, recurrence } = useMemo<{
        schedule: ParsedSchedule | null;
        recurrence: ParsedRecurrence | null;
    }>(() => {
        if (dismissed || !trimmed) return { schedule: null, recurrence: null };
        const now = new Date();
        return { schedule: parseSchedule(trimmed, now), recurrence: parseRecurrence(trimmed, now) };
    }, [trimmed, dismissed]);

    // Only the newest request may write, so out-of-order responses are dropped.
    const seq = useRef(0);
    const lastRequested = useRef("");

    useEffect(() => {
        if (trimmed.length < MIN_CHARS) {
            setFuzzy(null);
            return;
        }
        if (trimmed === lastRequested.current) return;

        const timer = setTimeout(() => {
            lastRequested.current = trimmed;
            const mine = ++seq.current;
            suggestTaskFieldsAPI(trimmed)
                .then((data) => {
                    if (mine !== seq.current) return;
                    setFuzzy(hasAny(data) ? data : null);
                })
                .catch(() => setFuzzy(null));
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [trimmed]);

    const dismiss = useCallback(() => setDismissedFor(trimmed), [trimmed]);

    return { schedule, recurrence, fuzzy, dismiss };
}
