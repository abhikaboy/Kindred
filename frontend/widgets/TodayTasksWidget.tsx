'widget';

import React from 'react';
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
    font,
    foregroundStyle,
    padding,
    frame,
    lineLimit,
    opacity,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type TodayTasksWidgetProps = {
    completedCount: number;
    totalCount: number;
    taskTitles: string[];
    workspaceGroups: { workspaceName: string; tasks: string[] }[];
};

const ACCENT = '#8B5CF6';

const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
const accent = foregroundStyle(ACCENT);

const TodayTasksWidget = (props: WidgetBase<TodayTasksWidgetProps>) => {
    'widget';

    const { completedCount, totalCount, taskTitles, workspaceGroups, family } = props;
    const progressText = totalCount > 0 ? `${completedCount}/${totalCount}` : '—';
    const allDone = totalCount > 0 && completedCount === totalCount;

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 13, design: 'rounded' }), accent]}>
                    Today
                </Text>
                <Spacer />
                <Text modifiers={[font({ weight: 'bold', size: 34, design: 'rounded' }), primary]}>
                    {progressText}
                </Text>
                <Text modifiers={[font({ weight: 'medium', size: 12 }), secondary]}>
                    {allDone ? 'All done! ✓' : totalCount > 0 ? 'tasks' : 'No tasks today'}
                </Text>
            </VStack>
        );
    }

    if (family === 'systemMedium') {
        const displayTasks = taskTitles.slice(0, 3);
        return (
            <HStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
                <VStack modifiers={[frame({ width: 100, alignment: 'leading' })]}>
                    <Text modifiers={[font({ weight: 'semibold', size: 13, design: 'rounded' }), accent]}>
                        Today
                    </Text>
                    <Spacer />
                    <Text modifiers={[font({ weight: 'bold', size: 30, design: 'rounded' }), primary]}>
                        {progressText}
                    </Text>
                    <Text modifiers={[font({ weight: 'medium', size: 11 }), secondary]}>
                        {allDone ? 'All done! ✓' : 'tasks'}
                    </Text>
                </VStack>
                <VStack modifiers={[frame({ maxWidth: 10000, alignment: 'leading' }), padding({ leading: 8 })]}>
                    {displayTasks.length > 0 ? (
                        displayTasks.map((title, i) => (
                            <HStack key={i}>
                                <Text modifiers={[font({ size: 10 }), foregroundStyle(ACCENT), opacity(0.7)]}>
                                    ●
                                </Text>
                                <Text
                                    modifiers={[font({ size: 13 }), secondary, lineLimit(1), padding({ leading: 4 })]}
                                >
                                    {title}
                                </Text>
                            </HStack>
                        ))
                    ) : (
                        <Text modifiers={[font({ size: 13 }), tertiary]}>
                            {allDone ? 'Everything checked off!' : 'Nothing due today'}
                        </Text>
                    )}
                </VStack>
            </HStack>
        );
    }

    return (
        <VStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
            <HStack>
                <Text modifiers={[font({ weight: 'semibold', size: 15, design: 'rounded' }), accent]}>
                    Today's Tasks
                </Text>
                <Spacer />
                <Text modifiers={[font({ weight: 'medium', size: 13, design: 'rounded' }), secondary]}>
                    {progressText}
                </Text>
            </HStack>
            {workspaceGroups.length > 0 ? (
                workspaceGroups.map((group, gi) => (
                    <VStack key={gi} modifiers={[padding({ top: 10 }), frame({ maxWidth: 10000, alignment: 'leading' })]}>
                        <Text modifiers={[font({ weight: 'semibold', size: 12 }), accent, opacity(0.8)]}>
                            {group.workspaceName}
                        </Text>
                        {group.tasks.slice(0, 4).map((title, ti) => (
                            <HStack key={ti} modifiers={[padding({ top: 2 })]}>
                                <Text modifiers={[font({ size: 9 }), foregroundStyle(ACCENT), opacity(0.6)]}>
                                    ●
                                </Text>
                                <Text
                                    modifiers={[font({ size: 13 }), secondary, lineLimit(1), padding({ leading: 4 })]}
                                >
                                    {title}
                                </Text>
                            </HStack>
                        ))}
                    </VStack>
                ))
            ) : (
                <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
                    <Spacer />
                    <Text modifiers={[font({ size: 14 }), tertiary]}>
                        {allDone ? 'All tasks complete! ✓' : 'No tasks due today'}
                    </Text>
                    <Spacer />
                </VStack>
            )}
        </VStack>
    );
};

export default createWidget('TodayTasksWidget', TodayTasksWidget);
