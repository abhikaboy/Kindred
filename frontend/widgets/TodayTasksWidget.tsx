'widget';

import React from 'react';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, frame } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type TodayTasksWidgetProps = {
    completedCount: number;
    totalCount: number;
    taskTitles: string[]; // top 3 for medium, all for large
    workspaceGroups: { workspaceName: string; tasks: string[] }[]; // for large
};

const TodayTasksWidget = (props: WidgetBase<TodayTasksWidgetProps>) => {
    'widget';

    const { completedCount, totalCount, taskTitles, workspaceGroups, family } = props;
    const progress = totalCount > 0 ? completedCount / totalCount : 0;
    const progressText = totalCount > 0 ? `${completedCount} / ${totalCount}` : 'No tasks';
    const allDone = totalCount > 0 && completedCount === totalCount;

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 16 })]}>
                <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle('#8B5CF6')]}>
                    Today
                </Text>
                <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle('#FFFFFF')]}>
                    {progressText}
                </Text>
                <Text modifiers={[font({ size: 12 }), foregroundStyle('#A0A0B0')]}>
                    {allDone ? 'All done!' : 'tasks'}
                </Text>
            </VStack>
        );
    }

    if (family === 'systemMedium') {
        const displayTasks = taskTitles.slice(0, 3);
        return (
            <HStack modifiers={[padding({ all: 16 })]}>
                <VStack modifiers={[frame({ width: 90 })]}>
                    <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle('#8B5CF6')]}>
                        Today
                    </Text>
                    <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle('#FFFFFF')]}>
                        {progressText}
                    </Text>
                    <Text modifiers={[font({ size: 11 }), foregroundStyle('#A0A0B0')]}>
                        {allDone ? 'All done!' : 'tasks'}
                    </Text>
                </VStack>
                <VStack>
                    {displayTasks.length > 0 ? (
                        displayTasks.map((title, i) => (
                            <Text
                                key={i}
                                modifiers={[font({ size: 13 }), foregroundStyle('#E0E0F0')]}
                            >
                                {`• ${title}`}
                            </Text>
                        ))
                    ) : (
                        <Text modifiers={[font({ size: 13 }), foregroundStyle('#A0A0B0')]}>
                            Nothing due today
                        </Text>
                    )}
                </VStack>
            </HStack>
        );
    }

    // systemLarge — grouped by workspace
    return (
        <VStack modifiers={[padding({ all: 16 })]}>
            <HStack>
                <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#8B5CF6')]}>
                    Today's Tasks
                </Text>
                <Text modifiers={[font({ size: 13 }), foregroundStyle('#A0A0B0')]}>
                    {progressText}
                </Text>
            </HStack>
            {workspaceGroups.length > 0 ? (
                workspaceGroups.map((group, gi) => (
                    <VStack key={gi} modifiers={[padding({ top: 8 })]}>
                        <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle('#8B5CF6')]}>
                            {group.workspaceName}
                        </Text>
                        {group.tasks.slice(0, 4).map((title, ti) => (
                            <Text
                                key={ti}
                                modifiers={[font({ size: 13 }), foregroundStyle('#E0E0F0')]}
                            >
                                {`• ${title}`}
                            </Text>
                        ))}
                    </VStack>
                ))
            ) : (
                <Text modifiers={[font({ size: 14 }), foregroundStyle('#A0A0B0')]}>
                    {allDone ? 'All tasks complete!' : 'No tasks due today'}
                </Text>
            )}
        </VStack>
    );
};

export default createWidget('TodayTasksWidget', TodayTasksWidget);
