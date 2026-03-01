'widget';

import React from 'react';
import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type DeadlineCountdownProps = {
    taskName: string;
    workspaceName: string;
    deadline: string; // ISO string
    priority: number; // 0-3
    timeRemainingLabel: string; // pre-formatted e.g. "2h 15m"
};

const PRIORITY_COLORS = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'];

const DeadlineCountdownComponent = (props: DeadlineCountdownProps) => {
    'widget';

    const { taskName, workspaceName, priority, timeRemainingLabel } = props;
    const priorityColor = PRIORITY_COLORS[Math.min(priority, 3)];
    const priorityLabel = PRIORITY_LABELS[Math.min(priority, 3)];

    return {
        banner: (
            <VStack modifiers={[padding({ all: 12 })]}>
                <HStack>
                    <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#FFFFFF')]}>
                        {taskName}
                    </Text>
                    <Text modifiers={[font({ size: 12 }), foregroundStyle(priorityColor)]}>
                        {priorityLabel}
                    </Text>
                </HStack>
                <HStack>
                    <Text modifiers={[font({ size: 13 }), foregroundStyle('#A0A0B0')]}>
                        {workspaceName}
                    </Text>
                    <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#8B5CF6')]}>
                        {`Due in ${timeRemainingLabel}`}
                    </Text>
                </HStack>
            </VStack>
        ),
        compactLeading: (
            <Image systemName="clock.fill" color="#8B5CF6" />
        ),
        compactTrailing: (
            <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle('#8B5CF6')]}>
                {timeRemainingLabel}
            </Text>
        ),
        minimal: (
            <Image systemName="clock.fill" color="#8B5CF6" />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="clock.fill" color="#8B5CF6" />
                <Text modifiers={[font({ size: 10 }), foregroundStyle('#A0A0B0')]}>
                    Deadline
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle('#8B5CF6')]}>
                    {timeRemainingLabel}
                </Text>
                <Text modifiers={[font({ size: 10 }), foregroundStyle('#A0A0B0')]}>
                    remaining
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 12 }), foregroundStyle('#A0A0B0')]}>
                    {workspaceName}
                </Text>
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
