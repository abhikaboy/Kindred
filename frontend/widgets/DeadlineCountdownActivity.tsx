'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type DeadlineCountdownProps = {
    taskName: string;
    workspaceName: string;
    deadline: string;
    priority: number;
    categoryId: string;
    taskId: string;
    accentColor: string;
    statusLabel: string;
};

const DeadlineCountdownComponent = (props: DeadlineCountdownProps) => {
    'widget';

    const PRIORITY_LABELS = ['', 'Low', 'Medium', 'High'];
    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

    const { taskName, workspaceName, deadline, priority, categoryId, taskId, accentColor, statusLabel } = props;
    const deadlineDate = new Date(deadline);
    const countdownStart = new Date(deadlineDate.getTime() - 60 * 60 * 1000);
    const priorityLabel = PRIORITY_LABELS[Math.min(priority, 3)];
    const deepLink = `kindred://task/${categoryId}/${taskId}`;

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 }), widgetURL(deepLink)]}>
                <HStack>
                    <Image systemName="circle.fill" color={accentColor} size={8} />
                    <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(accentColor)]}>
                        {statusLabel.toUpperCase()}
                    </Text>
                    <Spacer />
                    <Text
                        date={deadlineDate}
                        dateStyle="timer"
                        modifiers={[font({ weight: 'bold', size: 24, design: 'rounded' }), foregroundStyle(accentColor)]}
                    />
                </HStack>
                <HStack>
                    <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(1)]}>
                        {taskName}
                    </Text>
                    {priorityLabel ? (
                        <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(accentColor)]}>
                            {priorityLabel}
                        </Text>
                    ) : null}
                </HStack>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />
            </VStack>
        ),
        compactLeading: (
            <HStack>
                <Image systemName="circle.fill" color={accentColor} size={8} />
                <Text modifiers={[font({ weight: 'medium', size: 12 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={deadlineDate}
                dateStyle="timer"
                modifiers={[font({ weight: 'bold', size: 12, design: 'rounded' }), foregroundStyle(accentColor)]}
            />
        ),
        minimal: (
            <Image systemName="clock.fill" color={accentColor} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={accentColor} size={10} />
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    {statusLabel}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text
                    date={deadlineDate}
                    dateStyle="timer"
                    modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(accentColor)]}
                />
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
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
