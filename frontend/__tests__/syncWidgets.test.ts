const mockUpdaters = {
    TodayTasksWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
    WorkspaceSnapshotWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
    ActivityStreakWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
    LockScreenCircularWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
    LockScreenRectangularWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
    LockScreenInlineWidgetUpdater: { updateSnapshot: jest.fn(), updateTimeline: jest.fn() },
};
jest.mock('@/widgets/widgetUpdaters', () => mockUpdaters);

const mockActivityAPI = {
    getRecentActivity: jest.fn(),
    getCompletedTasksByDate: jest.fn(),
};
jest.mock('@/api/activity', () => ({
    activityAPI: mockActivityAPI,
    convertToWeeklyActivityLevels: () => [0, 1, 2, 3, 4, 0, 1, 2],
}));

import type { Task } from '@/api/types';

const dueSoon = (id: string): Task =>
    ({ id, content: id, priority: 1, deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString() }) as Task;

const lastTodayProps = () => {
    const calls = mockUpdaters.TodayTasksWidgetUpdater.updateTimeline.mock.calls;
    return calls[calls.length - 1][0][0].props;
};

describe('syncWidgets', () => {
    let sync: typeof import('@/widgets/syncWidgets');

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        sync = require('@/widgets/syncWidgets');
    });

    it('pushes today, lock screen, and workspace widgets from the task list', () => {
        sync.syncTaskWidgets([dueSoon('a')], [{ name: 'Work', isBlueprint: false, categories: [{ id: 'c', name: 'General', tags: [], tasks: [dueSoon('a')] }] }]);
        expect(lastTodayProps().remainingCount).toBe(1);
        expect(mockUpdaters.LockScreenCircularWidgetUpdater.updateTimeline).toHaveBeenCalled();
        expect(mockUpdaters.LockScreenRectangularWidgetUpdater.updateTimeline).toHaveBeenCalled();
        expect(mockUpdaters.WorkspaceSnapshotWidgetUpdater.updateSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceName: 'Work', pendingCount: 1 }),
        );
    });

    it('seeds the completed count from the server and bumps it on each completion', async () => {
        mockActivityAPI.getCompletedTasksByDate.mockResolvedValue([{}, {}]);
        sync.syncTaskWidgets([dueSoon('a'), dueSoon('b')], []);
        await sync.refreshCompletedToday();
        expect(lastTodayProps().completedCount).toBe(2);

        sync.noteTaskCompleted('a');
        const props = lastTodayProps();
        expect(props.completedCount).toBe(3);
        // The completed task drops out before the task list catches up
        expect(props.remainingCount).toBe(1);
    });

    it('feeds the streak widgets with real day labels and today count', async () => {
        mockActivityAPI.getRecentActivity.mockResolvedValue([]);
        await sync.syncStreakWidgets('user', 4);
        sync.noteTaskCompleted('x', 5);

        const calls = mockUpdaters.ActivityStreakWidgetUpdater.updateSnapshot.mock.calls;
        const props = calls[calls.length - 1][0];
        expect(props.streak).toBe(5);
        expect(props.completedToday).toBe(1);
        expect(props.days).toHaveLength(7);
        expect(mockUpdaters.LockScreenInlineWidgetUpdater.updateSnapshot).toHaveBeenLastCalledWith(props);
    });

    it('still updates the streak when recent activity fails to load', async () => {
        mockActivityAPI.getRecentActivity.mockRejectedValue(new Error('offline'));
        await sync.syncStreakWidgets('user', 7);
        expect(mockUpdaters.ActivityStreakWidgetUpdater.updateSnapshot).toHaveBeenCalledWith(expect.objectContaining({ streak: 7 }));
    });
});
