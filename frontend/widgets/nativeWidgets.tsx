'widget';

import React from 'react';
import { Text } from '@expo/ui/swift-ui';
import { createWidget } from 'expo-widgets';
import type {
    NextTaskWidgetProps,
    StreakWidgetProps,
    TodayWidgetProps,
    WorkspaceWidgetProps,
} from './widgetData';

// These widgets render natively (ios/ExpoWidgetsTarget/*.swift). expo-widgets is
// only the transport: createWidget registers the kind and stores the timeline
// props the SwiftUI views read. The layouts below are never displayed.

const Unused = () => {
    'widget';
    return <Text>Kindred</Text>;
};

export const TodayTasksWidget = createWidget<TodayWidgetProps>('TodayTasksWidget', Unused);
export const WorkspaceSnapshotWidget = createWidget<WorkspaceWidgetProps>('WorkspaceSnapshotWidget', Unused);
export const ActivityStreakWidget = createWidget<StreakWidgetProps>('ActivityStreakWidget', Unused);
export const LockScreenCircularWidget = createWidget<TodayWidgetProps>('LockScreenCircularWidget', Unused);
export const LockScreenRectangularWidget = createWidget<NextTaskWidgetProps>('LockScreenRectangularWidget', Unused);
export const LockScreenInlineWidget = createWidget<StreakWidgetProps>('LockScreenInlineWidget', Unused);
