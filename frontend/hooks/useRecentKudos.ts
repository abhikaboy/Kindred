import { useCallback, useMemo, useState } from "react";
import { useKudosOptional } from "@/contexts/kudosContext";
import { markEncouragementsReadAPI } from "@/api/encouragement";
import { markCongratulationsReadAPI } from "@/api/congratulation";

// Unread kudos from the last few days lead the home stack until acknowledged (mirrors desktop).
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_KUDOS = 3;

export type StageKudos = {
    id: string;
    kudosKind: "encouragement" | "congratulation";
    sender: { id: string; name: string; picture: string };
    message: string;
    taskName?: string;
    timestamp: string;
};

export function useRecentKudos(): { kudos: StageKudos[]; acknowledge: (k: StageKudos) => void } {
    const ctx = useKudosOptional();
    const [acked, setAcked] = useState<Set<string>>(() => new Set());

    const kudos = useMemo(() => {
        const cutoff = Date.now() - RECENT_MS;
        const recent = (k: { id: string; read: boolean; timestamp: string }) =>
            !k.read && !acked.has(k.id) && new Date(k.timestamp).getTime() >= cutoff;
        return [
            ...(ctx?.encouragements ?? []).filter(recent).map((k) => ({ ...k, kudosKind: "encouragement" as const })),
            ...(ctx?.congratulations ?? []).filter(recent).map((k) => ({ ...k, kudosKind: "congratulation" as const })),
        ]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, MAX_KUDOS)
            .map(
                (k): StageKudos => ({
                    id: k.id,
                    kudosKind: k.kudosKind,
                    sender: k.sender,
                    message: k.message,
                    taskName: k.taskName,
                    timestamp: k.timestamp,
                })
            );
    }, [ctx?.encouragements, ctx?.congratulations, acked]);

    // Drop the card right away; the server read flag follows.
    const acknowledge = useCallback((k: StageKudos) => {
        setAcked((prev) => new Set(prev).add(k.id));
        const mark = k.kudosKind === "encouragement" ? markEncouragementsReadAPI : markCongratulationsReadAPI;
        mark([k.id]).catch(() => {});
    }, []);

    return { kudos, acknowledge };
}
