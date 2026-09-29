import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/api/types";
import { pickWaitingCandidate } from "@/utils/waitingCandidate";
import { getSnoozedIds } from "@/utils/planSnooze";
import { usePlanSheet } from "@/hooks/planSheetStore";

/**
 * The one waiting task worth a gentle path today, plus whether others are eligible
 * too (only ever used to pick "1 thing" vs "A few things", never shown as a number).
 */
export function useWaitingCandidate(waiting: Task[]) {
    const [snoozedIds, setSnoozedIds] = useState<Set<string>>(() => new Set());
    const sheet = usePlanSheet();

    // Re-read snoozes whenever the sheet closes, since that's where they're set
    useEffect(() => {
        if (sheet) return;
        let live = true;
        getSnoozedIds()
            .then((ids) => live && setSnoozedIds(new Set(ids)))
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [sheet]);

    return useMemo(() => {
        const now = new Date();
        const opts = { now, snoozedIds };
        const candidate = pickWaitingCandidate(waiting as any[], opts) as Task | null;
        const several = candidate
            ? waiting.filter((t) => pickWaitingCandidate([t as any], opts)).length > 1
            : false;
        return { candidate, several };
    }, [waiting, snoozedIds]);
}
