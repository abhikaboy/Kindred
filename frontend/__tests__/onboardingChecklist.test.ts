import {
    computeCompletion,
    computeCompletedItems,
    computeVisibleItems,
    shouldShowCard,
    type ChecklistUser,
    type ItemKey,
} from '@/utils/onboardingChecklist';

const baseUser: ChecklistUser = {
    tasks_complete: 0,
    encouragements: 0,
    congratulations: 0,
    friends: [],
    first_all_rings_closed_at: null,
};

describe('computeCompletion', () => {
    it('flags task complete when tasks_complete > 0', () => {
        const c = computeCompletion({ ...baseUser, tasks_complete: 1 });
        expect(c.task).toBe(true);
    });

    it('flags kudos complete when encouragements + congratulations > 0', () => {
        expect(computeCompletion({ ...baseUser, encouragements: 1 }).kudos).toBe(true);
        expect(computeCompletion({ ...baseUser, congratulations: 1 }).kudos).toBe(true);
        expect(computeCompletion(baseUser).kudos).toBe(false);
    });

    it('flags friend complete when friends list non-empty', () => {
        expect(computeCompletion({ ...baseUser, friends: ['abc'] }).friend).toBe(true);
        expect(computeCompletion(baseUser).friend).toBe(false);
    });

    it('flags rings complete when first_all_rings_closed_at is set', () => {
        expect(computeCompletion({ ...baseUser, first_all_rings_closed_at: '2026-05-30T00:00:00Z' }).rings).toBe(true);
        expect(computeCompletion(baseUser).rings).toBe(false);
    });
});

describe('computeVisibleItems', () => {
    it('shows task/kudos/friend for a brand-new user (rings gated)', () => {
        const visible = computeVisibleItems({ task: false, kudos: false, friend: false, rings: false });
        expect(visible).toEqual(['task', 'kudos', 'friend']);
    });

    it('shows kudos/friend/rings once task is done', () => {
        const visible = computeVisibleItems({ task: true, kudos: false, friend: false, rings: false });
        expect(visible).toEqual(['kudos', 'friend', 'rings']);
    });

    it('keeps rings hidden when only kudos and friend are done (task still pending)', () => {
        const visible = computeVisibleItems({ task: false, kudos: true, friend: true, rings: false });
        expect(visible).toEqual(['task']);
    });

    it('shows just two items when task + kudos done', () => {
        const visible = computeVisibleItems({ task: true, kudos: true, friend: false, rings: false });
        expect(visible).toEqual(['friend', 'rings']);
    });

    it('shows nothing when all four are done', () => {
        const visible = computeVisibleItems({ task: true, kudos: true, friend: true, rings: true });
        expect(visible).toEqual([]);
    });
});

describe('computeCompletedItems', () => {
    it('returns nothing for a brand-new user', () => {
        expect(computeCompletedItems({ task: false, kudos: false, friend: false, rings: false })).toEqual([]);
    });

    it('returns completed items in priority order', () => {
        expect(computeCompletedItems({ task: true, kudos: false, friend: true, rings: false })).toEqual([
            'task',
            'friend',
        ]);
    });

    it('includes a completed rings even if task is still pending (no gating for done items)', () => {
        expect(computeCompletedItems({ task: false, kudos: false, friend: false, rings: true })).toEqual(['rings']);
    });

    it('returns all four when everything is done', () => {
        expect(computeCompletedItems({ task: true, kudos: true, friend: true, rings: true })).toEqual([
            'task',
            'kudos',
            'friend',
            'rings',
        ]);
    });

    it('never overlaps with the visible rotation', () => {
        const completion = { task: true, kudos: false, friend: false, rings: false };
        const done = computeCompletedItems(completion);
        const visible = computeVisibleItems(completion);
        expect(done.some((k) => visible.includes(k))).toBe(false);
    });
});

describe('shouldShowCard', () => {
    it('hides when dismissed', () => {
        const completion = { task: false, kudos: false, friend: false, rings: false };
        expect(shouldShowCard(completion, true)).toBe(false);
    });

    it('hides when all complete even if not dismissed', () => {
        const completion = { task: true, kudos: true, friend: true, rings: true };
        expect(shouldShowCard(completion, false)).toBe(false);
    });

    it('shows when at least one is incomplete and not dismissed', () => {
        const completion = { task: true, kudos: false, friend: false, rings: false };
        expect(shouldShowCard(completion, false)).toBe(true);
    });
});
