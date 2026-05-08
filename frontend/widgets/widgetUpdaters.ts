import { Widget, LiveActivityFactory } from 'expo-widgets';
import type { TodayTasksWidgetProps } from './TodayTasksWidget';
import type { WorkspaceSnapshotWidgetProps } from './WorkspaceSnapshotWidget';
import type { LockScreenCircularProps, LockScreenRectangularProps } from './LockScreenWidgets';
import type { ActivityStreakWidgetProps } from './ActivityStreakWidget';
import type { EncouragementActivityProps } from './EncouragementActivity';
import type { DeadlineCountdownProps } from './DeadlineCountdownActivity';

// Lightweight widget/activity handles for use in the main app bundle.
// These only call updateSnapshot/updateTimeline/start — they never render SwiftUI
// components, so they are safe to import outside of the widget extension target.

const noop = () => null as any;

export const TodayTasksWidgetUpdater = new Widget<TodayTasksWidgetProps>('TodayTasksWidget', noop);
export const WorkspaceSnapshotWidgetUpdater = new Widget<WorkspaceSnapshotWidgetProps>('WorkspaceSnapshotWidget', noop);
export const LockScreenCircularWidgetUpdater = new Widget<LockScreenCircularProps>('LockScreenCircularWidget', noop);
export const LockScreenRectangularWidgetUpdater = new Widget<LockScreenRectangularProps>('LockScreenRectangularWidget', noop);
export const ActivityStreakWidgetUpdater = new Widget<ActivityStreakWidgetProps>('ActivityStreakWidget', noop);
export const LockScreenInlineWidgetUpdater = new Widget<{ streak: number }>('LockScreenInlineWidget', noop);

export const EncouragementActivityFactory = new LiveActivityFactory<EncouragementActivityProps>('EncouragementActivity', noop);
export const DeadlineCountdownActivityFactory = new LiveActivityFactory<DeadlineCountdownProps>('DeadlineCountdownActivity', noop);
