import { friendshipBumpLabel, friendshipLevel } from "@shared/friendship";
import type { components } from "@/api/generated/types";

export type FriendshipDelta = components["schemas"]["Delta"];

/** One-line feedback for a score bump: the new level on level-up, else the points gained. */
export function friendshipFeedback(delta: FriendshipDelta): string {
    return delta.leveledUp
        ? `Now ${friendshipLevel(delta.score).name.toLowerCase()}`
        : friendshipBumpLabel(delta.delta);
}
