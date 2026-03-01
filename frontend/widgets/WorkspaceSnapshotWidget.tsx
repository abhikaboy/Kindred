'widget';

import React from 'react';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, frame } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type WorkspaceSnapshotWidgetProps = {
    workspaceName: string;
    workspaceIcon: string | null;
    workspaceColor: string | null;
    pendingCount: number;
    topTasks: string[];
};

const WorkspaceSnapshotWidget = (props: WidgetBase<WorkspaceSnapshotWidgetProps>) => {
    'widget';

    const { workspaceName, workspaceIcon, workspaceColor, pendingCount, topTasks, family } = props;
    const accentColor = workspaceColor || '#8B5CF6';
    const icon = workspaceIcon || '📋';

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 16 })]}>
                <Text modifiers={[font({ size: 28 })]}>
                    {icon}
                </Text>
                <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                    {workspaceName}
                </Text>
                <Text modifiers={[font({ weight: 'bold', size: 26 }), foregroundStyle(accentColor)]}>
                    {pendingCount}
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#A0A0B0')]}>
                    {pendingCount === 1 ? 'task pending' : 'tasks pending'}
                </Text>
            </VStack>
        );
    }

    // systemMedium
    return (
        <HStack modifiers={[padding({ all: 16 })]}>
            <VStack modifiers={[frame({ width: 90 })]}>
                <Text modifiers={[font({ size: 28 })]}>
                    {icon}
                </Text>
                <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                    {workspaceName}
                </Text>
                <Text modifiers={[font({ weight: 'bold', size: 22 }), foregroundStyle(accentColor)]}>
                    {pendingCount}
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#A0A0B0')]}>
                    {pendingCount === 1 ? 'pending' : 'pending'}
                </Text>
            </VStack>
            <VStack>
                {topTasks.length > 0 ? (
                    topTasks.map((title, i) => (
                        <Text
                            key={i}
                            modifiers={[font({ size: 13 }), foregroundStyle('#E0E0F0')]}
                        >
                            {`• ${title}`}
                        </Text>
                    ))
                ) : (
                    <Text modifiers={[font({ size: 13 }), foregroundStyle('#A0A0B0')]}>
                        No pending tasks
                    </Text>
                )}
            </VStack>
        </HStack>
    );
};

export default createWidget('WorkspaceSnapshotWidget', WorkspaceSnapshotWidget);
