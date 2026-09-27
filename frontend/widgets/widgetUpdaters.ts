import type {
    NextTaskWidgetProps,
    StreakWidgetProps,
    TimelineEntry,
    TodayWidgetProps,
    WorkspaceWidgetProps,
} from './widgetData';
import type { ActiveTaskActivityProps } from './ActiveTaskActivity';
import type { DeadlineCountdownProps } from './DeadlineCountdownActivity';

type WidgetLike<TProps> = {
    updateSnapshot: (props: TProps) => void;
    updateTimeline: (entries: TimelineEntry<TProps>[]) => void;
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
        updateTimeline: (entries) => {
            try { resolve().updateTimeline(entries); }
            catch (e) { console.warn(`[Widgets] ${name} updateTimeline failed:`, e); }
        },
    };
};

const createLiveActivityFactory = <TProps>(
    name: string,
    loadFactory: () => LiveActivityLike<TProps>,
): LiveActivityLike<TProps> => {
    let instance: LiveActivityLike<TProps> | null = null;
    let loadError: unknown = null;

    const resolve = (): LiveActivityLike<TProps> => {
        if (instance) return instance;
        try {
            instance = loadFactory();
            loadError = null;
        } catch (e) {
            console.error(`[Widgets] Failed to load live activity ${name}:`, e);
            loadError = e;
            instance = createNoopLiveActivityFactory<TProps>();
        }
        return instance;
    };

    return {
        start: (props, url?) => {
            resolve();
            if (loadError) {
                console.error(`[Widgets] ${name} unavailable:`, loadError);
                return noopLiveActivityInstance<TProps>();
            }
            // iOS caps concurrent Live Activities per target — best-effort end any
            // existing one so starting replaces it instead of throwing "maximum
            // number of activities already exists".
            try {
                instance!.getInstances().forEach((a) => a.end().catch(() => {}));
            } catch {}
            try {
                return instance!.start(props, url);
            } catch (e) {
                console.error(`[Widgets] ${name} start failed:`, e);
                return noopLiveActivityInstance<TProps>();
            }
        },
        getInstances: () => {
            try { return resolve().getInstances(); }
            catch (e) {
                console.error(`[Widgets] ${name} getInstances failed:`, e);
                return [];
            }
        },
    };
};

/* eslint-disable @typescript-eslint/no-require-imports */

export const TodayTasksWidgetUpdater = createWidgetUpdater<TodayWidgetProps>(
    'TodayTasksWidget',
    () => require('./nativeWidgets').TodayTasksWidget,
);

export const WorkspaceSnapshotWidgetUpdater = createWidgetUpdater<WorkspaceWidgetProps>(
    'WorkspaceSnapshotWidget',
    () => require('./nativeWidgets').WorkspaceSnapshotWidget,
);

export const ActivityStreakWidgetUpdater = createWidgetUpdater<StreakWidgetProps>(
    'ActivityStreakWidget',
    () => require('./nativeWidgets').ActivityStreakWidget,
);

export const LockScreenCircularWidgetUpdater = createWidgetUpdater<TodayWidgetProps>(
    'LockScreenCircularWidget',
    () => require('./nativeWidgets').LockScreenCircularWidget,
);

export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<NextTaskWidgetProps>(
    'LockScreenRectangularWidget',
    () => require('./nativeWidgets').LockScreenRectangularWidget,
);

export const LockScreenInlineWidgetUpdater = createWidgetUpdater<StreakWidgetProps>(
    'LockScreenInlineWidget',
    () => require('./nativeWidgets').LockScreenInlineWidget,
);

export const ActiveTaskActivityFactory = createLiveActivityFactory<ActiveTaskActivityProps>(
    'ActiveTaskActivity',
    () => require('./ActiveTaskActivity').default,
);

export const DeadlineCountdownActivityFactory = createLiveActivityFactory<DeadlineCountdownProps>(
    'DeadlineCountdownActivity',
    () => require('./DeadlineCountdownActivity').default,
);
