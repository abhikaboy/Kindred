'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer, Button } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL, frame, cornerRadius, background, monospacedDigit, buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type ActiveTaskActivityProps = {
    taskName: string;
    workspaceName: string;
    startTime: string;
    endTime?: string;
    hasEndTime: boolean;
    categoryId: string;
    taskId: string;
};

const ActiveTaskActivityComponent = (props: ActiveTaskActivityProps) => {
    'widget';

    const GREEN = '#22C55E';
    const PURPLE = '#8B5CF6';
    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

    const { taskName, workspaceName, startTime, endTime, hasEndTime, categoryId, taskId } = props;
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : undefined;
    const encodedName = encodeURIComponent(taskName);
    const taskLink = `kindred:///(logged-in)/(tabs)/(task)/task/${taskId}?categoryId=${categoryId}&name=${encodedName}`;

    return {
        banner: (
            <VStack alignment="leading" spacing={12} modifiers={[padding({ horizontal: 20, vertical: 16 }), widgetURL(taskLink), frame({ maxWidth: 9999 })]}>
                {/* Row 1: Task name + timer */}
                <HStack alignment="center">
                    <VStack alignment="leading" spacing={2}>
                        <Text modifiers={[font({ weight: 'semibold', size: 16 }), primary, lineLimit(1)]}>
                            {taskName}
                        </Text>
                        <HStack alignment="center" spacing={4}>
                            <Image systemName="circle.fill" color={GREEN} size={5} />
                            <Text modifiers={[font({ size: 12 }), secondary]}>
                                {workspaceName}
                            </Text>
                        </HStack>
                    </VStack>
                    <Spacer />
                    <Text
                        date={startDate}
                        dateStyle="timer"
                        modifiers={[
                            font({ weight: 'bold', size: 24, design: 'rounded' }),
                            foregroundStyle(PURPLE),
                            monospacedDigit(),
                        ]}
                    />
                </HStack>

                {/* Row 2: Progress bar (only with end time) */}
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}

                {/* Row 3: CTA Button */}
                <Button
                    target="complete"
                    modifiers={[
                        buttonStyle('borderedProminent'),
                        cornerRadius(18),
                    ]}
                >
                    <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#FFFFFF')]}>
                        Complete
                    </Text>
                </Button>
            </VStack>
        ),
        compactLeading: (
            <HStack alignment="center" spacing={4}>
                <Image systemName="circle.fill" color={GREEN} size={6} />
                <Text modifiers={[font({ weight: 'semibold', size: 12 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={startDate}
                dateStyle="timer"
                modifiers={[
                    font({ weight: 'bold', size: 13, design: 'rounded' }),
                    foregroundStyle(PURPLE),
                    monospacedDigit(),
                ]}
            />
        ),
        minimal: (
            <Image systemName="circle.fill" color={GREEN} size={8} />
        ),
        expandedLeading: (
            <VStack alignment="leading" spacing={4}>
                <HStack alignment="center" spacing={4}>
                    <Image systemName="circle.fill" color={GREEN} size={5} />
                    <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(GREEN)]}>
                        ACTIVE
                    </Text>
                </HStack>
                <Text modifiers={[font({ weight: 'semibold', size: 15 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <Text
                date={startDate}
                dateStyle="timer"
                modifiers={[
                    font({ weight: 'bold', size: 22, design: 'rounded' }),
                    foregroundStyle(PURPLE),
                    monospacedDigit(),
                ]}
            />
        ),
        expandedBottom: (
            <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 15 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}
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

export default createLiveActivity('ActiveTaskActivity', ActiveTaskActivityComponent);
