import type { TodayTasksWidgetProps } from './TodayTasksWidget';
import type { WorkspaceSnapshotWidgetProps } from './WorkspaceSnapshotWidget';
import type { LockScreenCircularProps, LockScreenRectangularProps } from './LockScreenWidgets';
import type { ActivityStreakWidgetProps } from './ActivityStreakWidget';
import type { EncouragementActivityProps } from './EncouragementActivity';
import type { DeadlineCountdownProps } from './DeadlineCountdownActivity';

// Lightweight widget/activity handles for use in the main app bundle.
// These only call updateSnapshot/updateTimeline/start — they never render SwiftUI
// components, so they are safe to import outside of the widget extension target.

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

let _cachedModule: {
    Widget: new <TProps>(name: string, render: () => unknown) => WidgetLike<TProps>;
    LiveActivityFactory: new <TProps>(name: string, render: () => unknown) => LiveActivityLike<TProps>;
} | null | undefined;

const resolveExpoWidgets = () => {
    if (_cachedModule !== undefined) return _cachedModule;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const widgets = require('expo-widgets');
        console.log('[Widgets] expo-widgets module resolved successfully', Object.keys(widgets));
        _cachedModule = widgets;
        return widgets;
    } catch (e) {
        console.warn('[Widgets] expo-widgets not available:', e);
        _cachedModule = null;
        return null;
    }
};

const noop = () => null as unknown;

// Lazy initialization: native Widget/LiveActivity handles are created on first
// use rather than at module load time, avoiding TurboModule calls during JS
// bundle evaluation that can trigger Hermes GC crashes on RN 0.83 + iOS 18.
const createWidgetUpdater = <TProps>(name: string): WidgetLike<TProps> => {
    let instance: WidgetLike<TProps> | null = null;

    const resolve = (): WidgetLike<TProps> => {
        if (instance) return instance;
        try {
            const mod = resolveExpoWidgets();
            if (mod) {
                instance = new mod.Widget<TProps>(name, noop);
                console.log(`[Widgets] Created native widget handle: ${name}`);
            } else {
                console.warn(`[Widgets] No module, using noop for: ${name}`);
                instance = createNoopWidget<TProps>();
            }
        } catch (e) {
            console.warn(`[Widgets] Failed to create widget ${name}:`, e);
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

const createLiveActivityFactory = <TProps>(name: string): LiveActivityLike<TProps> => {
    let instance: LiveActivityLike<TProps> | null = null;

    const resolve = (): LiveActivityLike<TProps> => {
        if (instance) return instance;
        try {
            const mod = resolveExpoWidgets();
            instance = mod ? new mod.LiveActivityFactory<TProps>(name, noop) : createNoopLiveActivityFactory<TProps>();
        } catch {
            instance = createNoopLiveActivityFactory<TProps>();
        }
        return instance;
    };

    return {
        start: (props) => resolve().start(props),
    };
};

export const TodayTasksWidgetUpdater = createWidgetUpdater<TodayTasksWidgetProps>('TodayTasksWidget');
export const WorkspaceSnapshotWidgetUpdater = createWidgetUpdater<WorkspaceSnapshotWidgetProps>('WorkspaceSnapshotWidget');
export const LockScreenCircularWidgetUpdater = createWidgetUpdater<LockScreenCircularProps>('LockScreenCircularWidget');
export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<LockScreenRectangularProps>('LockScreenRectangularWidget');
export const ActivityStreakWidgetUpdater = createWidgetUpdater<ActivityStreakWidgetProps>('ActivityStreakWidget');
export const LockScreenInlineWidgetUpdater = createWidgetUpdater<{ streak: number }>('LockScreenInlineWidget');

export const EncouragementActivityFactory = createLiveActivityFactory<EncouragementActivityProps>('EncouragementActivity');
export const DeadlineCountdownActivityFactory = createLiveActivityFactory<DeadlineCountdownProps>('DeadlineCountdownActivity');
