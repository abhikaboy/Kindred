import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendshipBumpLabel, friendshipLevel } from "@shared/friendship";
import type { components } from "@/lib/api/types.gen";

export type FriendshipDelta = components["schemas"]["Delta"];

/** Level-up announcement when the bump crossed a floor, otherwise a short points label. */
export function friendshipToastMessage(delta: FriendshipDelta, name: string): string {
  if (delta.leveledUp) {
    return `You and ${name} are now ${friendshipLevel(delta.score).name.toLowerCase()}`;
  }
  return friendshipBumpLabel(delta.delta, name);
}

// One toast plus a refresh of the receiver's profile so the meter is current.
export function useFriendshipBump(): (delta: FriendshipDelta | undefined, name: string) => void {
  const qc = useQueryClient();
  return (delta, name) => {
    if (!delta) return;
    toast.success(friendshipToastMessage(delta, name));
    // ponytail: prefix-invalidate every cached profile instead of threading the receiver id.
    qc.invalidateQueries({ queryKey: ["get", "/v1/user/profiles/{id}"] });
  };
}
