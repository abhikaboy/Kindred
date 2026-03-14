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

let _cachedModule: {
    Widget: new <TProps>(name: string, render: () => unknown) => WidgetLike<TProps>;
    LiveActivityFactory: new <TProps>(name: string, render: () => unknown) => LiveActivityLike<TProps>;
} | null | undefined;

const resolveExpoWidgets = () => {
    if (_cachedModule !== undefined) return _cachedModule;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const widgets = require('expo-widgets');
        _cachedModule = widgets;
        return widgets;
    } catch (e) {
        console.warn('[Widgets] expo-widgets not available:', e);
        _cachedModule = null;
        return null;
    }
};

const noop = () => null as unknown;

// Lightweight noop Widget handles for timeline-data updates.
//
// The Widget constructor always writes its `layout` argument to shared
// UserDefaults.  We pass a noop here so the constructor is cheap and safe
// (no @expo/ui module loading, minimal TurboModule traffic).
//
// The *correct* babel-compiled layouts are written later by
// registerWidgetLayouts(), which must be called once from a deferred
// context (InteractionManager.runAfterInteractions) after the app has
// settled.  Because the noop handles only call updateTimeline (which
// writes entries + reloads but never re-writes the layout), the correct
// layout persists in UserDefaults for the widget extension to evaluate.
const createWidgetUpdater = <TProps>(name: string): WidgetLike<TProps> => {
    let instance: WidgetLike<TProps> | null = null;

    const resolve = (): WidgetLike<TProps> => {
        if (instance) return instance;
        try {
            const mod = resolveExpoWidgets();
            if (mod) {
                instance = new (mod.Widget as new (n: string, r: () => unknown) => WidgetLike<TProps>)(name, noop);
            } else {
                instance = createNoopWidget<TProps>();
            }
        } catch (e) {
            console.warn(`[Widgets] Failed to create widget ${name}:`, e);
            instance = createNoopWidget<TProps>();
        }
        return instance;
    };

    return {
        updateSnapshot: (props) => resolve().updateSnapshot(props),
        updateTimeline: (props) => resolve().updateTimeline(props),
    };
};

const createLiveActivityFactory = <TProps>(name: string): LiveActivityLike<TProps> => {
    let instance: LiveActivityLike<TProps> | null = null;

    const resolve = (): LiveActivityLike<TProps> => {
        if (instance) return instance;
        try {
            const mod = resolveExpoWidgets();
            instance = mod
                ? new (mod.LiveActivityFactory as new (n: string, r: () => unknown) => LiveActivityLike<TProps>)(name, noop)
                : createNoopLiveActivityFactory<TProps>();
        } catch {
            instance = createNoopLiveActivityFactory<TProps>();
        }
        return instance;
    };

    return {
        start: (props) => resolve().start(props),
    };
};

const WIDGET_MODULES = [
    './TodayTasksWidget',
    './WorkspaceSnapshotWidget',
    './ActivityStreakWidget',
    './LockScreenWidgets',
] as const;

/**
 * Load the actual widget modules so their `createWidget()` calls store the
 * babel-compiled layout strings in shared UserDefaults, overwriting any noop
 * placeholder that was written by the lightweight handles above.
 *
 * Call this once from a deferred context (e.g. InteractionManager.runAfterInteractions)
 * AFTER the initial render has settled — loading these modules pulls in @expo/ui
 * native components, and doing so during a busy period can trigger a Hermes GC
 * race via ObjCTurboModule error handling (RN 0.83 / iOS 18).
 *
 * Each module is required individually so a failure in one (e.g. ExpoUI native
 * module emitter setup) doesn't prevent the others from registering.
 */
export function registerWidgetLayouts(): void {
    // Temporarily suppress the ExpoUI "addListener" warning that fires when
    // @expo/ui/swift-ui/modifiers is first loaded in the main app — the
    // native event emitter isn't needed for widget layout registration.
    const origWarn = console.warn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.warn = (...args: any[]) => {
        const msg = typeof args[0] === 'string' ? args[0] : '';
        if (msg.includes('addListener') || msg.includes('native') && msg.includes('logger')) return;
        origWarn.apply(console, args);
    };

    const modules = [
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        () => require('./TodayTasksWidget'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        () => require('./WorkspaceSnapshotWidget'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        () => require('./ActivityStreakWidget'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        () => require('./LockScreenWidgets'),
    ];

    let registered = 0;
    for (const load of modules) {
        try {
            load();
            registered++;
        } catch (e) {
            console.log('[Widgets] Module failed to register layout:', e);
        }
    }

    console.warn = origWarn;

    if (registered > 0) {
        console.log(`[Widgets] ${registered}/${modules.length} layout strings registered`);
    } else {
        console.log('[Widgets] No layouts registered — widgets will use placeholder content');
    }
}

export const TodayTasksWidgetUpdater = createWidgetUpdater<TodayTasksWidgetProps>('TodayTasksWidget');
export const WorkspaceSnapshotWidgetUpdater = createWidgetUpdater<WorkspaceSnapshotWidgetProps>('WorkspaceSnapshotWidget');
export const LockScreenCircularWidgetUpdater = createWidgetUpdater<LockScreenCircularProps>('LockScreenCircularWidget');
export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<LockScreenRectangularProps>('LockScreenRectangularWidget');
export const ActivityStreakWidgetUpdater = createWidgetUpdater<ActivityStreakWidgetProps>('ActivityStreakWidget');
export const LockScreenInlineWidgetUpdater = createWidgetUpdater<{ streak: number }>('LockScreenInlineWidget');

export const EncouragementActivityFactory = createLiveActivityFactory<EncouragementActivityProps>('EncouragementActivity');
export const DeadlineCountdownActivityFactory = createLiveActivityFactory<DeadlineCountdownProps>('DeadlineCountdownActivity');
