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

type LiveActivityLike<TProps> = {
    start: (props: TProps) => { end: (reason?: string) => void };
};

const createNoopWidget = <TProps>(): WidgetLike<TProps> => ({
    updateSnapshot: () => { },
    updateTimeline: () => { },
});

const createNoopLiveActivityFactory = <TProps>(): LiveActivityLike<TProps> => ({
    start: () => ({ end: () => { } }),
});

// Lazy initialization: widget modules are loaded on first use via require()
// rather than at module load time, avoiding TurboModule calls during JS bundle
// evaluation that can trigger Hermes GC crashes on RN 0.83 + iOS 18.
//
// IMPORTANT: We must import the actual widget modules (not a noop stub) because
// the Widget constructor writes the babel-compiled layout string to shared
// UserDefaults. The widget extension reads this layout at render time — if we
// pass a noop, the layout key holds garbage and the extension produces empty
// entries, resulting in missing .chrono-timeline files and persistent failures.
const createWidgetUpdater = <TProps>(
    name: string,
    lazyImport: () => { updateSnapshot: (props: TProps) => void },
): WidgetLike<TProps> => {
    let instance: WidgetLike<TProps> | null = null;

    const resolve = (): WidgetLike<TProps> => {
        if (instance) return instance;
        try {
            const widget = lazyImport();
            console.log(`[Widgets] Loaded widget handle: ${name}`);
            instance = {
                updateSnapshot: (props) => widget.updateSnapshot(props),
                updateTimeline: () => { },
            };
        } catch (e) {
            console.warn(`[Widgets] Failed to load widget ${name}:`, e);
            instance = createNoopWidget<TProps>();
        }
        return instance;
    };

    return {
        updateSnapshot: (props) => {
            console.log(`[Widgets] updateSnapshot called for ${name}`, JSON.stringify(props).slice(0, 200));
            resolve().updateSnapshot(props);
        },
        updateTimeline: (props) => resolve().updateTimeline(props),
    };
};

const createLiveActivityUpdater = <TProps>(
    name: string,
    lazyImport: () => { start: (props: TProps, url?: string) => { end: (reason?: string) => void } },
): LiveActivityLike<TProps> => {
    let instance: LiveActivityLike<TProps> | null = null;

    const resolve = (): LiveActivityLike<TProps> => {
        if (instance) return instance;
        try {
            const factory = lazyImport();
            console.log(`[Widgets] Loaded live activity handle: ${name}`);
            instance = { start: (props) => factory.start(props) };
        } catch (e) {
            console.warn(`[Widgets] Failed to load live activity ${name}:`, e);
            instance = createNoopLiveActivityFactory<TProps>();
        }
        return instance;
    };

    return {
        start: (props) => resolve().start(props),
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
export const LockScreenCircularWidgetUpdater = createWidgetUpdater<LockScreenCircularProps>(
    'LockScreenCircularWidget',
    () => require('./LockScreenWidgets').LockScreenCircularWidget,
);
export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<LockScreenRectangularProps>(
    'LockScreenRectangularWidget',
    () => require('./LockScreenWidgets').LockScreenRectangularWidget,
);
export const ActivityStreakWidgetUpdater = createWidgetUpdater<ActivityStreakWidgetProps>(
    'ActivityStreakWidget',
    () => require('./ActivityStreakWidget').default,
);
export const LockScreenInlineWidgetUpdater = createWidgetUpdater<{ streak: number }>(
    'LockScreenInlineWidget',
    () => require('./LockScreenWidgets').LockScreenInlineWidget,
);

export const EncouragementActivityFactory = createLiveActivityUpdater<EncouragementActivityProps>(
    'EncouragementActivity',
    () => require('./EncouragementActivity').default,
);
export const DeadlineCountdownActivityFactory = createLiveActivityUpdater<DeadlineCountdownProps>(
    'DeadlineCountdownActivity',
    () => require('./DeadlineCountdownActivity').default,
);
/* eslint-enable @typescript-eslint/no-require-imports */
