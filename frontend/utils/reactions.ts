import type { SlackReaction } from "@/components/cards/PostCard";
import type { UserExtendedReference } from "@/api/profile";

export type ReactionGroup = {
    emoji: string;
    count: number;
    users: UserExtendedReference[];
};

/** Build emoji-grouped reactor lists, dropping IDs that didn't resolve to a user. */
export function buildReactionGroups(
    reactions: SlackReaction[],
    usersById: Map<string, UserExtendedReference>,
): ReactionGroup[] {
    return reactions.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        users: r.ids
            .map((id) => usersById.get(id))
            .filter((u): u is UserExtendedReference => u !== undefined),
    }));
}
