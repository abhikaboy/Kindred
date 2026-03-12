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

const resolveExpoWidgets = () => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const widgets = require('expo-widgets');
        return widgets as {
            Widget: new <TProps>(name: string, render: () => unknown) => WidgetLike<TProps>;
            LiveActivityFactory: new <TProps>(name: string, render: () => unknown) => LiveActivityLike<TProps>;
        };
    } catch {
        return null;
    }
};

// TODO: Re-enable once crash is diagnosed. Set to null to skip all native widget calls.
const expoWidgets = __DEV__ ? resolveExpoWidgets() : null;
const noop = () => null as unknown;

const createWidgetUpdater = <TProps>(name: string): WidgetLike<TProps> => {
    try {
        if (!expoWidgets) return createNoopWidget<TProps>();
        return new expoWidgets.Widget<TProps>(name, noop);
    } catch {
        return createNoopWidget<TProps>();
    }
};

const createLiveActivityFactory = <TProps>(name: string): LiveActivityLike<TProps> => {
    try {
        if (!expoWidgets) return createNoopLiveActivityFactory<TProps>();
        return new expoWidgets.LiveActivityFactory<TProps>(name, noop);
    } catch {
        return createNoopLiveActivityFactory<TProps>();
    }
};

export const TodayTasksWidgetUpdater = createWidgetUpdater<TodayTasksWidgetProps>('TodayTasksWidget');
export const WorkspaceSnapshotWidgetUpdater = createWidgetUpdater<WorkspaceSnapshotWidgetProps>('WorkspaceSnapshotWidget');
export const LockScreenCircularWidgetUpdater = createWidgetUpdater<LockScreenCircularProps>('LockScreenCircularWidget');
export const LockScreenRectangularWidgetUpdater = createWidgetUpdater<LockScreenRectangularProps>('LockScreenRectangularWidget');
export const ActivityStreakWidgetUpdater = createWidgetUpdater<ActivityStreakWidgetProps>('ActivityStreakWidget');
export const LockScreenInlineWidgetUpdater = createWidgetUpdater<{ streak: number }>('LockScreenInlineWidget');

export const EncouragementActivityFactory = createLiveActivityFactory<EncouragementActivityProps>('EncouragementActivity');
export const DeadlineCountdownActivityFactory = createLiveActivityFactory<DeadlineCountdownProps>('DeadlineCountdownActivity');
