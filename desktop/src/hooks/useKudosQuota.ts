import { useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/auth";
import type { KudosKind } from "@/hooks/useKudos";

// Desktop has no updateUser, so sends are counted locally against the last-known
// allowance; a fresh allowance from the server (new baseline) resets the count.
type Used = { base: string; encouragement: number; congratulation: number };
let used: Used = { base: "", encouragement: 0, congratulation: 0 };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => used;

export function useKudosQuota(): {
  encouragementsLeft: number;
  congratulationsLeft: number;
  recordSent: (kind: KudosKind) => void;
} {
  const { user } = useAuth();
  const current = useSyncExternalStore(subscribe, snapshot);
  const enc = user?.encouragements ?? 0;
  const con = user?.congratulations ?? 0;
  const base = `${user?._id ?? ""}:${enc}:${con}`;
  const counts = current.base === base ? current : { encouragement: 0, congratulation: 0 };

  return {
    encouragementsLeft: Math.max(0, enc - counts.encouragement),
    congratulationsLeft: Math.max(0, con - counts.congratulation),
    recordSent: (kind) => {
      const prev = used.base === base ? used : { base, encouragement: 0, congratulation: 0 };
      used = { ...prev, base, [kind]: prev[kind] + 1 };
      listeners.forEach((fn) => fn());
    },
  };
}
