jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type FakeInstance = { update: jest.Mock; end: jest.Mock; props: any };

const makeFactory = () => {
    const instances: FakeInstance[] = [];
    return {
        instances,
        start: jest.fn((props: any) => {
            // Mirrors createLiveActivityFactory: starting replaces any running activity
            instances.splice(0).forEach((i) => i.end());
            const instance = { update: jest.fn(() => Promise.resolve()), end: jest.fn(() => Promise.resolve()), props };
            instances.push(instance);
            return instance;
        }),
        getInstances: jest.fn(() => instances),
    };
};

const mockActive = makeFactory();
const mockDeadline = makeFactory();

jest.mock('@/widgets/widgetUpdaters', () => ({
    ActiveTaskActivityFactory: mockActive,
    DeadlineCountdownActivityFactory: mockDeadline,
}));

const activeProps = (taskId: string) => ({
    taskName: 'Write report',
    workspaceName: 'Work',
    startTime: new Date().toISOString(),
    hasEndTime: false,
    categoryId: 'cat',
    taskId,
});

const deadlineProps = (taskId: string, inMs: number) => ({
    taskName: 'Submit form',
    workspaceName: 'Work',
    deadline: new Date(Date.now() + inMs).toISOString(),
    priority: 2,
    categoryId: 'cat',
    taskId,
});

describe('liveActivityManager', () => {
    let manager: typeof import('@/utils/liveActivityManager');
    let AsyncStorage: any;

    beforeEach(async () => {
        jest.resetModules();
        // The deadline activity keeps a refresh interval; fake timers stop it leaking
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        for (const f of [mockActive, mockDeadline]) {
            f.instances.length = 0;
            f.start.mockClear();
            f.getInstances.mockClear();
        }
        AsyncStorage = require('@react-native-async-storage/async-storage');
        await AsyncStorage.clear();
        manager = require('@/utils/liveActivityManager');
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('starts, reports, and ends an activity', async () => {
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'))).toBe(true);
        expect(manager.isActivityRunning('a')).toBe(true);
        const instance = mockActive.instances[0];

        await manager.endActivity('a');
        expect(instance.end).toHaveBeenCalled();
        expect(manager.isActivityRunning('a')).toBe(false);
    });

    it('does not start a second activity for the same task', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'))).toBe(false);
        expect(mockActive.start).toHaveBeenCalledTimes(1);
    });

    it('forgets a replaced activity of the same type so it can be restarted', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        await manager.tryStartActiveTaskActivity('b', activeProps('b'));
        expect(manager.isActivityRunning('a')).toBe(false);
        expect(manager.isActivityRunning('b')).toBe(true);
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'))).toBe(true);
    });

    it('keeps activities of different types independent', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        await manager.tryStartDeadlineActivity('d', deadlineProps('d', 45 * 60 * 1000));
        expect(manager.isActivityRunning('a')).toBe(true);
        expect(manager.isActivityRunning('d')).toBe(true);
    });

    it('computes the deadline status at start instead of trusting the caller', async () => {
        await manager.tryStartDeadlineActivity('d', deadlineProps('d', 5 * 60 * 1000));
        expect(mockDeadline.instances[0].props.statusLabel).toBe('Due soon');
        expect(mockDeadline.instances[0].props.accentColor).toBe(manager.DEADLINE_COLORS.soon);
    });

    it('re-attaches to the native activity after an app restart so it can still be ended', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        const nativeInstance = mockActive.instances[0];

        // Simulate a fresh JS runtime with the activity still on the lock screen
        const persisted = await AsyncStorage.getItem('@kindred/active-live-activities');
        jest.resetModules();
        AsyncStorage = require('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('@kindred/active-live-activities', persisted);
        const restarted: typeof import('@/utils/liveActivityManager') = require('@/utils/liveActivityManager');
        await restarted.endActivity('a');

        expect(nativeInstance.end).toHaveBeenCalled();
        expect(JSON.parse(await AsyncStorage.getItem('@kindred/active-live-activities'))).toEqual([]);
    });

    it('drops stored entries whose native activity is gone', async () => {
        await AsyncStorage.setItem('@kindred/active-live-activities', JSON.stringify([{ taskId: 'x', type: 'active' }, 'legacy-id']));
        await manager.tryStartDeadlineActivity('d', deadlineProps('d', 45 * 60 * 1000));
        expect(manager.isActivityRunning('x')).toBe(false);
    });
});

describe('liveActivityManager lifecycle', () => {
    let manager: typeof import('@/utils/liveActivityManager');

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
        for (const f of [mockActive, mockDeadline]) {
            f.instances.length = 0;
            f.start.mockClear();
        }
        await require('@react-native-async-storage/async-storage').clear();
        manager = require('@/utils/liveActivityManager');
    });

    afterEach(() => jest.useRealTimers());

    it('dismissal ends the activity and blocks the scheduler from restarting it', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        const instance = mockActive.instances[0];
        await manager.dismissActivity('a');

        expect(instance.end).toHaveBeenCalledWith('immediate');
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'))).toBe(false);
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'), { userInitiated: true })).toBe(true);
    });

    it('ends activities for completed or deleted tasks', async () => {
        const props = deadlineProps('d', 45 * 60 * 1000);
        await manager.tryStartDeadlineActivity('d', props);
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));

        await manager.reconcileActivities([
            { id: 'd', deadline: props.deadline, timeCompleted: new Date().toISOString() },
            { id: 'other' },
        ]);

        expect(manager.isActivityRunning('d')).toBe(false);
        expect(manager.isActivityRunning('a')).toBe(false);
    });

    it('ends a deadline activity when the deadline is removed or changed', async () => {
        const props = deadlineProps('d', 45 * 60 * 1000);
        await manager.tryStartDeadlineActivity('d', props);
        await manager.reconcileActivities([{ id: 'd', deadline: props.deadline }]);
        expect(manager.isActivityRunning('d')).toBe(true);

        await manager.reconcileActivities([{ id: 'd', deadline: new Date(Date.now() + 3 * 3600 * 1000).toISOString() }]);
        expect(manager.isActivityRunning('d')).toBe(false);
    });

    it('treats an activity swiped off the lock screen as dismissed', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        mockActive.instances.length = 0;

        await manager.reconcileActivities([{ id: 'a' }]);

        expect(manager.isActivityRunning('a')).toBe(false);
        expect(await manager.tryStartActiveTaskActivity('a', activeProps('a'))).toBe(false);
    });

    it('does nothing while the task list is still empty', async () => {
        await manager.tryStartActiveTaskActivity('a', activeProps('a'));
        await manager.reconcileActivities([]);
        expect(manager.isActivityRunning('a')).toBe(true);
    });
});

describe('deadlineStatus', () => {
    const { deadlineStatus, DEADLINE_COLORS } = jest.requireActual('@/utils/liveActivityManager');
    const now = 1_000_000_000_000;

    it.each([
        [45 * 60 * 1000, 'Upcoming', DEADLINE_COLORS.upcoming],
        [10 * 60 * 1000, 'Due soon', DEADLINE_COLORS.soon],
        [0, 'Overdue', DEADLINE_COLORS.overdue],
        [-60 * 1000, 'Overdue', DEADLINE_COLORS.overdue],
    ])('%d ms before the deadline is %s', (remaining, label, color) => {
        expect(deadlineStatus(now + remaining, now)).toEqual({ statusLabel: label, accentColor: color });
    });
});
