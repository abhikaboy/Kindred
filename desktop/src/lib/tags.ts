import type { components } from "@/lib/api/types.gen";

export type TaggedUser = components["schemas"]["TaggedTaskUser"];

// Non-pending tags (watching/copied/untagged) are locked by the backend and can't
// be removed; keep them in every payload so the merge preserves them.
export const isLocked = (u: TaggedUser): boolean => u.status !== "pending";

// The full desired taggedUserIds list for PATCH .../tags: locked ids (always kept)
// plus the currently-selected pending ids. Deduped.
export function tagPayload(current: TaggedUser[], selectedPendingIds: string[]): string[] {
  const locked = current.filter(isLocked).map((u) => u.id);
  return Array.from(new Set([...locked, ...selectedPendingIds]));
}

export const pendingIds = (current: TaggedUser[]): string[] =>
  current.filter((u) => !isLocked(u)).map((u) => u.id);
