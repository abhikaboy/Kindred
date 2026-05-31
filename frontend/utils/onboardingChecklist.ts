export type ItemKey = 'task' | 'kudos' | 'friend' | 'rings';

export interface ChecklistUser {
    tasks_complete: number;
    encouragements: number;
    congratulations: number;
    friends: string[];
    first_all_rings_closed_at: string | null | undefined;
}

export type CompletionMap = Record<ItemKey, boolean>;

export function computeCompletion(user: ChecklistUser): CompletionMap {
    return {
        task: user.tasks_complete > 0,
        kudos: (user.encouragements ?? 0) + (user.congratulations ?? 0) > 0,
        friend: user.friends.length > 0,
        rings: !!user.first_all_rings_closed_at,
    };
}

const PRIORITY: ItemKey[] = ['task', 'kudos', 'friend', 'rings'];

export function computeVisibleItems(completion: CompletionMap): ItemKey[] {
    const incomplete = PRIORITY.filter((key) => !completion[key]);
    const gated = completion.task ? incomplete : incomplete.filter((k) => k !== 'rings');
    return gated.slice(0, 3);
}

export function shouldShowCard(completion: CompletionMap, dismissed: boolean): boolean {
    if (dismissed) return false;
    return Object.values(completion).some((done) => !done);
}
