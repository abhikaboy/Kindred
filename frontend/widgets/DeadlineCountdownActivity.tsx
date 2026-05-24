'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer, Button } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL, cornerRadius, frame, monospacedDigit, buttonStyle } from '@expo/ui/swift-ui/modifiers';
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
    const encodedName = encodeURIComponent(taskName);
    const taskLink = `kindred:///(logged-in)/(tabs)/(task)/task/${taskId}?categoryId=${categoryId}&name=${encodedName}`;

    return {
        banner: (
            <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 20, vertical: 16 }), widgetURL(taskLink)]}>
                {/* Row 1: Status + Countdown */}
                <HStack alignment="center" modifiers={[frame({ maxWidth: 9999 })]}>
                    <HStack alignment="center" spacing={5}>
                        <Image systemName="circle.fill" color={accentColor} size={7} />
                        <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(accentColor)]}>
                            {statusLabel.toUpperCase()}
                        </Text>
                    </HStack>
                    <Spacer />
                    <Text
                        date={deadlineDate}
                        dateStyle="timer"
                        modifiers={[font({ weight: 'bold', size: 15, design: 'rounded' }), foregroundStyle(accentColor), monospacedDigit()]}
                    />
                </HStack>

                {/* Row 2: Task name */}
                <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(2)]}>
                    {taskName}
                </Text>

                {/* Row 3: Workspace + Priority */}
                <HStack spacing={6}>
                    <Text modifiers={[font({ size: 13 }), secondary]}>
                        {workspaceName}
                    </Text>
                    {priorityLabel ? (
                        <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(accentColor)]}>
                            {priorityLabel}
                        </Text>
                    ) : null}
                </HStack>

                {/* Row 4: Depleting progress bar */}
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />

                {/* Row 5: CTA Button */}
                <Button
                    target="complete"
                    modifiers={[
                        buttonStyle('borderedProminent'),
                        cornerRadius(12),
                    ]}
                >
                    <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                        Mark Complete
                    </Text>
                </Button>
            </VStack>
        ),
        compactLeading: (
            <HStack alignment="center" spacing={4}>
                <Image systemName="circle.fill" color={accentColor} size={6} />
                <Text modifiers={[font({ weight: 'semibold', size: 12 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={deadlineDate}
                dateStyle="timer"
                modifiers={[font({ weight: 'bold', size: 13, design: 'rounded' }), foregroundStyle(accentColor)]}
            />
        ),
        minimal: (
            <Image systemName="clock.fill" color={accentColor} />
        ),
        expandedLeading: (
            <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={accentColor} size={8} />
                <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(accentColor)]}>
                    {statusLabel}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 8 })]}>
                <Text
                    date={deadlineDate}
                    dateStyle="timer"
                    modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(accentColor)]}
                />
                <Text modifiers={[font({ size: 10 }), secondary]}>
                    remaining
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 15 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />
                <Button
                    target="complete"
                    modifiers={[
                        buttonStyle('borderedProminent'),
                        cornerRadius(10),
                    ]}
                >
                    <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#FFFFFF')]}>
                        Complete
                    </Text>
                </Button>
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
