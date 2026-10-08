import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import { useKudos, type KudosKind } from "@/hooks/useKudos";

// Unread kudos from the last few days lead the home stack until acknowledged.
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_KUDOS = 3;

const AUTH = { Authorization: "", refresh_token: "" };

export type StageKudos = {
  id: string;
  kudosKind: KudosKind;
  sender: { id: string; name: string; picture: string };
  message: string;
  taskId?: string;
  taskName?: string;
  timestamp: string;
};

export function useRecentKudos(): { kudos: StageKudos[]; acknowledge: (k: StageKudos) => void } {
  const { encouragements, congratulations } = useKudos();
  const qc = useQueryClient();

  const kudos = useMemo(() => {
    const cutoff = Date.now() - RECENT_MS;
    const recent = (k: { read: boolean; timestamp: string }) =>
      !k.read && new Date(k.timestamp).getTime() >= cutoff;
    return [
      ...encouragements.filter(recent).map((k) => ({ ...k, kudosKind: "encouragement" as const })),
      ...congratulations.filter(recent).map((k) => ({ ...k, kudosKind: "congratulation" as const })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_KUDOS)
      .map(
        (k): StageKudos => ({
          id: k.id,
          kudosKind: k.kudosKind,
          sender: k.sender,
          message: k.message,
          taskId: "taskId" in k ? k.taskId : undefined,
          taskName: k.taskName,
          timestamp: k.timestamp,
        }),
      );
  }, [encouragements, congratulations]);

  const markEnc = $api.useMutation("patch", "/v1/user/encouragements/mark-read");
  const markCon = $api.useMutation("patch", "/v1/user/congratulations/mark-read");

  // Flip `read` in the cache right away so the card leaves the stack without waiting.
  const acknowledge = (k: StageKudos) => {
    const key = k.kudosKind === "encouragement" ? "/v1/user/encouragements" : "/v1/user/congratulations";
    qc.setQueriesData<{ id: string; read: boolean }[]>({ queryKey: ["get", key] }, (list) =>
      list?.map((item) => (item.id === k.id ? { ...item, read: true } : item)),
    );
    const vars = { params: { header: AUTH }, body: { id: [k.id] } };
    if (k.kudosKind === "encouragement") markEnc.mutate(vars);
    else markCon.mutate(vars);
  };

  return { kudos, acknowledge };
}
