import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseRecurrence, parseSchedule, type ParsedRecurrence, type ParsedSchedule } from "@shared/taskSuggest";
import { $api } from "@/lib/api/query";
import { CREATE_AUTH } from "@/hooks/useCreateActions";

export type FuzzySuggestion = { categoryId?: string; priority?: number; value?: number };

const MIN_CHARS = 6;
const DEBOUNCE_MS = 600;

let TIMEZONE: string | undefined;
try {
    TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
} catch {
    TIMEZONE = undefined;
}

const hasAny = (f: FuzzySuggestion) => f.categoryId !== undefined || f.priority !== undefined || f.value !== undefined;

/**
 * Two tiers off one input: schedule parsed locally on every keystroke, and
 * category/priority/difficulty fetched once typing settles. Both are additive,
 * so every failure path just yields nothing.
 */
export function useTaskSuggestions(text: string) {
    const trimmed = text.trim();
    const [dismissedFor, setDismissedFor] = useState<string | null>(null);
    const [fuzzy, setFuzzy] = useState<FuzzySuggestion | null>(null);
    const suggest = $api.useMutation("post", "/v1/user/tasks/suggest");

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
    const mutateRef = useRef(suggest.mutateAsync);
    mutateRef.current = suggest.mutateAsync;

    useEffect(() => {
        if (trimmed.length < MIN_CHARS) {
            setFuzzy(null);
            return;
        }
        if (trimmed === lastRequested.current) return;

        const timer = setTimeout(() => {
            lastRequested.current = trimmed;
            const mine = ++seq.current;
            mutateRef
                .current({ params: { header: CREATE_AUTH }, body: { text: trimmed, timezone: TIMEZONE } })
                .then((data) => {
                    if (mine !== seq.current) return;
                    const next: FuzzySuggestion = {
                        categoryId: data.categoryId,
                        priority: data.priority,
                        value: data.value,
                    };
                    setFuzzy(hasAny(next) ? next : null);
                })
                .catch(() => setFuzzy(null));
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [trimmed]);

    const dismiss = useCallback(() => setDismissedFor(trimmed), [trimmed]);

    return { schedule, recurrence, fuzzy, dismiss };
}
