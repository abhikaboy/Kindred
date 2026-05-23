'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer, Link } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL, frame, cornerRadius, background, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
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
    const LIGHT_PURPLE = '#C4B5FD';
    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

    const { taskName, workspaceName, startTime, endTime, hasEndTime, categoryId, taskId } = props;
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : undefined;
    const encodedName = encodeURIComponent(taskName);
    const taskLink = `kindred:///(logged-in)/(tabs)/(task)/task/${taskId}?categoryId=${categoryId}&name=${encodedName}`;
    const completeLink = `kindred:///(logged-in)/(tabs)/(task)/task/${taskId}?categoryId=${categoryId}&name=${encodedName}&action=complete`;

    return {
        banner: (
            <VStack alignment="leading" spacing={12} modifiers={[padding({ horizontal: 20, vertical: 16 }), widgetURL(taskLink), frame({ maxWidth: 9999 })]}>
                {/* Row 1: Status + Timer */}
                <HStack alignment="center">
                    <HStack alignment="center" spacing={5}>
                        <Image systemName="circle.fill" color={GREEN} size={7} />
                        <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(GREEN)]}>
                            ACTIVE
                        </Text>
                    </HStack>
                    <Spacer />
                    <Text
                        date={startDate}
                        dateStyle="timer"
                        modifiers={[
                            font({ weight: 'bold', size: 22, design: 'rounded' }),
                            foregroundStyle(PURPLE),
                            monospacedDigit(),
                        ]}
                    />
                </HStack>

                {/* Row 2: Task name + workspace */}
                <VStack alignment="leading" spacing={3}>
                    <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(2)]}>
                        {taskName}
                    </Text>
                    <Text modifiers={[font({ size: 14 }), secondary]}>
                        {workspaceName}
                    </Text>
                </VStack>

                {/* Row 3: Progress bar (only with end time) */}
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}

                {/* Row 4: CTA Buttons */}
                <HStack spacing={8}>
                    <Link
                        destination={completeLink}
                        modifiers={[
                            padding({ horizontal: 16, vertical: 9 }),
                            background(PURPLE),
                            cornerRadius(20),
                        ]}
                    >
                        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                            Complete
                        </Text>
                    </Link>
                    <Link
                        destination={taskLink}
                        modifiers={[
                            padding({ horizontal: 16, vertical: 9 }),
                            background('rgba(255,255,255,0.1)'),
                            cornerRadius(20),
                        ]}
                    >
                        <Text modifiers={[font({ weight: 'medium', size: 14 }), secondary]}>
                            Open Task
                        </Text>
                    </Link>
                </HStack>
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
                modifiers={[font({ weight: 'bold', size: 13, design: 'rounded' }), foregroundStyle(PURPLE)]}
            />
        ),
        minimal: (
            <Image systemName="bolt.fill" color={PURPLE} />
        ),
        expandedLeading: (
            <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={GREEN} size={8} />
                <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(GREEN)]}>
                    Active
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 8 })]}>
                <Text
                    date={startDate}
                    dateStyle="timer"
                    modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(PURPLE)]}
                />
                <Text modifiers={[font({ size: 10 }), secondary]}>
                    {hasEndTime ? 'remaining' : 'elapsed'}
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
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}
                <HStack spacing={8}>
                    <Link
                        destination={completeLink}
                        modifiers={[
                            padding({ horizontal: 14, vertical: 8 }),
                            background(PURPLE),
                            cornerRadius(10),
                        ]}
                    >
                        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#FFFFFF')]}>
                            Complete
                        </Text>
                    </Link>
                    <Link
                        destination={taskLink}
                        modifiers={[
                            font({ weight: 'medium', size: 13 }),
                            padding({ horizontal: 14, vertical: 8 }),
                            cornerRadius(10),
                        ]}
                    >
                        <Text modifiers={[font({ weight: 'medium', size: 13 }), secondary]}>
                            Open
                        </Text>
                    </Link>
                </HStack>
            </VStack>
        ),
    };
};

export default createLiveActivity('ActiveTaskActivity', ActiveTaskActivityComponent);
