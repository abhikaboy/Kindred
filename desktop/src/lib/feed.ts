export type ReactionGroup = { emoji: string; count: number; ids: string[]; mine: boolean };

// One group per emoji key with a non-empty ids array; count = ids.length.
export function buildReactionGroups(
    reactions: Record<string, string[]> | undefined,
    myId?: string,
): ReactionGroup[] {
    if (!reactions) {
        return [];
    }
    const groups: ReactionGroup[] = [];
    for (const emoji of Object.keys(reactions)) {
        const ids = reactions[emoji];
        if (!ids || ids.length === 0) {
            continue;
        }
        groups.push({
            emoji,
            count: ids.length,
            ids,
            mine: myId ? ids.includes(myId) : false,
        });
    }
    return groups;
}

export type CaptionSegment = { text: string; mention: boolean };

const MENTION_RE = /@[A-Za-z0-9_]+/g;

// Split caption into alternating text / @mention segments; no empty segments.
export function segmentCaption(caption: string): CaptionSegment[] {
    const segments: CaptionSegment[] = [];
    let lastIndex = 0;
    for (const match of caption.matchAll(MENTION_RE)) {
        const start = match.index;
        if (start > lastIndex) {
            segments.push({ text: caption.slice(lastIndex, start), mention: false });
        }
        segments.push({ text: match[0], mention: true });
        lastIndex = start + match[0].length;
    }
    if (lastIndex < caption.length) {
        segments.push({ text: caption.slice(lastIndex), mention: false });
    }
    return segments;
}
