import type { TodayTasksWidgetProps } from './TodayTasksWidget';
import type { WorkspaceSnapshotWidgetProps } from './WorkspaceSnapshotWidget';
import type { LockScreenCircularProps, LockScreenRectangularProps } from './LockScreenWidgets';
import type { ActivityStreakWidgetProps } from './ActivityStreakWidget';
import type { EncouragementActivityProps } from './EncouragementActivity';
import type { DeadlineCountdownProps } from './DeadlineCountdownActivity';

type WidgetLike<TProps> = {
    updateSnapshot: (props: TProps) => void;
    updateTimeline: (props: TProps[]) => void;
};

type LiveActivityInstance<TProps> = {
    update: (props: TProps) => Promise<void>;
    end: (dismissalPolicy?: string) => Promise<void>;
    addPushTokenListener: (listener: (event: { activityId: string; pushToken: string }) => void) => { remove: () => void };
    getPushToken: () => Promise<string>;
};

type LiveActivityLike<TProps> = {
    start: (props: TProps, url?: string) => LiveActivityInstance<TProps>;
    getInstances: () => LiveActivityInstance<TProps>[];
};

const createNoopWidget = <TProps>(): WidgetLike<TProps> => ({
    updateSnapshot: () => { },
    updateTimeline: () => { },
});

const noopLiveActivityInstance = <TProps>(): LiveActivityInstance<TProps> => ({
    update: () => Promise.resolve(),
    end: () => Promise.resolve(),
    addPushTokenListener: () => ({ remove: () => { } }),
    getPushToken: () => Promise.resolve(''),
});

const createNoopLiveActivityFactory = <TProps>(): LiveActivityLike<TProps> => ({
    start: () => noopLiveActivityInstance<TProps>(),
    getInstances: () => [],
});

/**
 * Lazily loads a Widget instance from the actual widget module.
 *
 * expo-widgets' `createWidget(name, component)` returns a Widget handle
 * whose constructor writes the babel-compiled layout to shared UserDefaults.
 * Using that handle for `updateSnapshot` ensures the correct layout persists.
 *
 * The require() is deferred to first use so @expo/ui native modules are not
 * loaded during JS bundle evaluation (avoids Hermes GC issues on RN 0.83).
 */
const createWidgetUpdater = <TProps>(
    name: string,
    loadWidget: () => WidgetLike<TProps>,
): WidgetLike<TProps> => {
    let instance: WidgetLike<TProps> | null = null;

    const resolve = (): WidgetLike<TProps> => {
        if (instance) return instance;
        try {
            instance = loadWidget();
        } catch (e) {
            console.warn(`[Widgets] Failed to load widget ${name}:`, e);
            instance = createNoopWidget<TProps>();
        }
        return instance;
    };

    return {
        updateSnapshot: (props) => {
            try { resolve().updateSnapshot(props); }
            catch (e) { console.warn(`[Widgets] ${name} updateSnapshot failed:`, e); }
        },
        updateTimeline: (props) => {
            try { resolve().updateTimeline(props); }
            catch (e) { console.warn(`[Widgets] ${name} updateTimeline failed:`, e); }
        },
    };
};

const createLiveActivityFactory = <TProps>(
    name: string,
    loadFactory: () => LiveActivityLike<TProps>,
): LiveActivityLike<TProps> => {
    let instance: LiveActivityLike<TProps> | null = null;

    const resolve = (): LiveActivityLike<TProps> => {
        if (instance) return instance;
        try {
            instance = loadFactory();
        } catch (e) {
            console.warn(`[Widgets] Failed to load live activity ${name}:`, e);
            instance = createNoopLiveActivityFactory<TProps>();
        }
        return instance;
    };

    return {
        start: (props, url?) => {
            try { return resolve().start(props, url); }
            catch (e) {
                console.warn(`[Widgets] ${name} start failed:`, e);
                return noopLiveActivityInstance<TProps>();
            }
        },
        getInstances: () => {
            try { return resolve().getInstances(); }
            catch (e) {
                console.warn(`[Widgets] ${name} getInstances failed:`, e);
                return [];
            }
        },
    };
};

/* eslint-disable @typescript-eslint/no-require-imports */

export const TodayTasksWidgetUpdater = createWidgetUpdater<TodayTasksWidgetProps>(
    'TodayTasksWidget',
    () => require('./TodayTasksWidget').default,
);

export const WorkspaceSnapshotWidgetUpdater = createWidgetUpdater<WorkspaceSnapshotWidgetProps>(
    'WorkspaceSnapshotWidget',
    () => require('./WorkspaceSnapshotWidget').default,
);

export const ActivityStreakWidgetUpdater = createWidgetUpdater<ActivityStreakWidgetProps>(
    'ActivityStreakWidget',
    () => require('./ActivityStreakWidget').default,
);

export const LockScreenCircularWidgetUpdater = createWidgetUpdater<LockScreenCircularProps>(
    'LockScreenCircularWidget',
    () => require('./LockScreenWidgets').LockScreenCircularWidget,
);

export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<LockScreenRectangularProps>(
    'LockScreenRectangularWidget',
    () => require('./LockScreenWidgets').LockScreenRectangularWidget,
);

export const LockScreenInlineWidgetUpdater = createWidgetUpdater<{ streak: number }>(
    'LockScreenInlineWidget',
    () => require('./LockScreenWidgets').LockScreenInlineWidget,
);

export const EncouragementActivityFactory = createLiveActivityFactory<EncouragementActivityProps>(
    'EncouragementActivity',
    () => require('./EncouragementActivity').default,
);

export const DeadlineCountdownActivityFactory = createLiveActivityFactory<DeadlineCountdownProps>(
    'DeadlineCountdownActivity',
    () => require('./DeadlineCountdownActivity').default,
);
