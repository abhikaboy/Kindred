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
    background,
    cornerRadius,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type WorkspaceSnapshotWidgetProps = {
    workspaceName: string;
    workspaceIcon: string;
    workspaceColor: string;
    pendingCount: number;
    topTasks: string[];
};

const WorkspaceSnapshotWidget = (props: WidgetBase<WorkspaceSnapshotWidgetProps>) => {
    'widget';

    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
    const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

    const { workspaceName, workspaceIcon, workspaceColor, pendingCount, topTasks, family } = props;
    const accentColor = workspaceColor || '#8B5CF6';
    const icon = workspaceIcon || '📋';
    const accent = foregroundStyle(accentColor);

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
                <HStack>
                    <Text modifiers={[font({ size: 22 })]}>
                        {icon}
                    </Text>
                    <Spacer />
                </HStack>
                <Text modifiers={[font({ weight: 'semibold', size: 13 }), primary, lineLimit(1)]}>
                    {workspaceName}
                </Text>
                <Spacer />
                <Text modifiers={[font({ weight: 'bold', size: 30, design: 'rounded' }), accent]}>
                    {pendingCount}
                </Text>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), secondary]}>
                    {pendingCount === 1 ? 'task pending' : 'tasks pending'}
                </Text>
            </VStack>
        );
    }

    return (
        <HStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
            <VStack modifiers={[frame({ width: 90, alignment: 'leading' })]}>
                <Text modifiers={[font({ size: 22 })]}>
                    {icon}
                </Text>
                <Text modifiers={[font({ weight: 'semibold', size: 13 }), primary, lineLimit(1)]}>
                    {workspaceName}
                </Text>
                <Spacer />
                <Text modifiers={[font({ weight: 'bold', size: 26, design: 'rounded' }), accent]}>
                    {pendingCount}
                </Text>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), secondary]}>
                    pending
                </Text>
            </VStack>
            <VStack modifiers={[frame({ maxWidth: 10000, alignment: 'leading' }), padding({ leading: 8 })]}>
                {topTasks.length > 0 ? (
                    topTasks.map((title, i) => (
                        <HStack
                            key={i}
                            modifiers={[
                                padding({ horizontal: 10, vertical: 6 }),
                                frame({ maxWidth: 10000, alignment: 'leading' }),
                                background('#78788014'),
                                cornerRadius(8),
                                padding({ top: i === 0 ? 0 : 3 }),
                            ]}
                        >
                            <Text modifiers={[font({ size: 8 }), foregroundStyle(accentColor), opacity(0.8)]}>
                                ●
                            </Text>
                            <Text
                                modifiers={[font({ size: 13 }), primary, lineLimit(1), padding({ leading: 4 })]}
                            >
                                {title}
                            </Text>
                        </HStack>
                    ))
                ) : (
                    <VStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}>
                        <Spacer />
                        <Text modifiers={[font({ size: 13 }), tertiary]}>
                            No pending tasks
                        </Text>
                        <Spacer />
                    </VStack>
                )}
            </VStack>
        </HStack>
    );
};

export default createWidget('WorkspaceSnapshotWidget', WorkspaceSnapshotWidget);
