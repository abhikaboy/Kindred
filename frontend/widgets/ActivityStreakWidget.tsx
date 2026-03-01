'widget';

import React from 'react';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, frame } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type ActivityStreakWidgetProps = {
    streak: number;
    tasksCompletedToday: number;
    // 7 values, oldest first, each 0-4 (activity level)
    weeklyLevels: number[];
};

const LEVEL_COLORS = ['#2A2A3A', '#4C1D95', '#6D28D9', '#7C3AED', '#8B5CF6'];

const ActivityStreakWidget = (props: WidgetBase<ActivityStreakWidgetProps>) => {
    'widget';

    const { streak, tasksCompletedToday, weeklyLevels, family } = props;

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 16 })]}>
                <Text modifiers={[font({ size: 28 })]}>🔥</Text>
                <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle('#FFFFFF')]}>
                    {streak}
                </Text>
                <Text modifiers={[font({ size: 12 }), foregroundStyle('#A0A0B0')]}>
                    {streak === 1 ? 'day streak' : 'day streak'}
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#8B5CF6')]}>
                    {`${tasksCompletedToday} done today`}
                </Text>
            </VStack>
        );
    }

    // systemMedium — streak + 7-day bar chart
    const levels = weeklyLevels.length === 7 ? weeklyLevels : new Array(7).fill(0);
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
        <HStack modifiers={[padding({ all: 16 })]}>
            <VStack modifiers={[frame({ width: 90 })]}>
                <Text modifiers={[font({ size: 24 })]}>🔥</Text>
                <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle('#FFFFFF')]}>
                    {streak}
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#A0A0B0')]}>
                    day streak
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#8B5CF6')]}>
                    {`${tasksCompletedToday} today`}
                </Text>
            </VStack>
            <VStack>
                <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle('#A0A0B0')]}>
                    Last 7 days
                </Text>
                <HStack>
                    {levels.map((level, i) => (
                        <VStack key={i}>
                            <Text
                                modifiers={[
                                    font({ size: 22 }),
                                    foregroundStyle(LEVEL_COLORS[Math.min(level, 4)]),
                                ]}
                            >
                                ■
                            </Text>
                            <Text modifiers={[font({ size: 9 }), foregroundStyle('#606070')]}>
                                {days[i]}
                            </Text>
                        </VStack>
                    ))}
                </HStack>
            </VStack>
        </HStack>
    );
};

export default createWidget('ActivityStreakWidget', ActivityStreakWidget);
