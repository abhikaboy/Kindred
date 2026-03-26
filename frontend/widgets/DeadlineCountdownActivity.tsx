'widget';

import React from 'react';
import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type DeadlineCountdownProps = {
    taskName: string;
    workspaceName: string;
    deadline: string;
    priority: number;
    timeRemainingLabel: string;
};

const PRIORITY_COLORS = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'];

const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

const ACCENT = '#8B5CF6';

const DeadlineCountdownComponent = (props: DeadlineCountdownProps) => {
    'widget';

    const { taskName, workspaceName, priority, timeRemainingLabel } = props;
    const priorityColor = PRIORITY_COLORS[Math.min(priority, 3)];
    const priorityLabel = PRIORITY_LABELS[Math.min(priority, 3)];

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 })]}>
                <HStack>
                    <Image systemName="clock.fill" color={ACCENT} size={14} />
                    <Text modifiers={[font({ weight: 'semibold', size: 15 }), primary, lineLimit(1)]}>
                        {taskName}
                    </Text>
                    <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(priorityColor)]}>
                        {priorityLabel}
                    </Text>
                </HStack>
                <HStack>
                    <Text modifiers={[font({ size: 13 }), secondary]}>
                        {workspaceName}
                    </Text>
                    <Text modifiers={[font({ weight: 'bold', size: 13, design: 'rounded' }), foregroundStyle(ACCENT)]}>
                        {`Due in ${timeRemainingLabel}`}
                    </Text>
                </HStack>
            </VStack>
        ),
        compactLeading: (
            <Image systemName="clock.fill" color={ACCENT} />
        ),
        compactTrailing: (
            <Text modifiers={[font({ weight: 'bold', size: 12, design: 'rounded' }), foregroundStyle(ACCENT)]}>
                {timeRemainingLabel}
            </Text>
        ),
        minimal: (
            <Image systemName="clock.fill" color={ACCENT} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="clock.fill" color={ACCENT} size={22} />
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    Deadline
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(ACCENT)]}>
                    {timeRemainingLabel}
                </Text>
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    remaining
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 14 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
