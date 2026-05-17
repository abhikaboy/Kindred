'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
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
    const deepLink = `kindred://task/${categoryId}/${taskId}`;

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 }), widgetURL(deepLink)]}>
                <HStack>
                    <Image systemName="circle.fill" color={GREEN} size={8} />
                    <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(GREEN)]}>
                        ACTIVE
                    </Text>
                    <Spacer />
                    <VStack>
                        <Text
                            date={startDate}
                            dateStyle="timer"
                            modifiers={[font({ weight: 'bold', size: 24, design: 'rounded' }), foregroundStyle(PURPLE)]}
                        />
                        {!hasEndTime ? (
                            <Text modifiers={[font({ size: 11 }), secondary]}>
                                elapsed
                            </Text>
                        ) : null}
                    </VStack>
                </HStack>
                <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(1)]}>
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
            </VStack>
        ),
        compactLeading: (
            <HStack>
                <Image systemName="circle.fill" color={GREEN} size={8} />
                <Text modifiers={[font({ weight: 'medium', size: 12 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={startDate}
                dateStyle="timer"
                modifiers={[font({ weight: 'bold', size: 12, design: 'rounded' }), foregroundStyle(PURPLE)]}
            />
        ),
        minimal: (
            <Image systemName="bolt.fill" color={PURPLE} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={GREEN} size={10} />
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    Active
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text
                    date={startDate}
                    dateStyle="timer"
                    modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(PURPLE)]}
                />
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    {hasEndTime ? 'remaining' : 'elapsed'}
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
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}
            </VStack>
        ),
    };
};

export default createLiveActivity('ActiveTaskActivity', ActiveTaskActivityComponent);
