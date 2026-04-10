'widget';

import React from 'react';
import { Text, VStack, HStack, Spacer } from '@expo/ui/swift-ui';
import {
    font,
    foregroundStyle,
    padding,
    frame,
    cornerRadius,
    opacity,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

export type ActivityStreakWidgetProps = {
    streak: number;
    tasksCompletedToday: number;
    // 7 values, oldest first, each 0-4 (activity level)
    weeklyLevels: number[];
};

const ActivityStreakWidget = (props: WidgetBase<ActivityStreakWidgetProps>) => {
    'widget';

    const ACCENT = '#8B5CF6';
    const LEVEL_COLORS = ['#78788033', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA'];
    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
    const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
    const accent = foregroundStyle(ACCENT);

    const { streak, tasksCompletedToday, weeklyLevels, family } = props;

    if (family === 'systemSmall') {
        return (
            <VStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 13, design: 'rounded' }), accent]}>
                    Streak
                </Text>
                <Spacer />
                <HStack modifiers={[frame({ alignment: 'bottom' })]}>
                    <Text modifiers={[font({ weight: 'bold', size: 36, design: 'rounded' }), primary]}>
                        {streak}
                    </Text>
                    <Text modifiers={[font({ size: 20 }), padding({ bottom: 3 })]}>
                        🔥
                    </Text>
                </HStack>
                <Text modifiers={[font({ weight: 'medium', size: 12 }), secondary]}>
                    {streak === 1 ? 'day' : 'days'}
                </Text>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), accent]}>
                    {`${tasksCompletedToday} done today`}
                </Text>
            </VStack>
        );
    }

    const levels = weeklyLevels.length === 7 ? weeklyLevels : new Array(7).fill(0);
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
        <HStack modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' })]}>
            <VStack modifiers={[frame({ width: 100, alignment: 'leading' })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 13, design: 'rounded' }), accent]}>
                    Streak
                </Text>
                <Spacer />
                <HStack modifiers={[frame({ alignment: 'bottom' })]}>
                    <Text modifiers={[font({ weight: 'bold', size: 32, design: 'rounded' }), primary]}>
                        {streak}
                    </Text>
                    <Text modifiers={[font({ size: 18 }), padding({ bottom: 2 })]}>
                        🔥
                    </Text>
                </HStack>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), secondary]}>
                    {streak === 1 ? 'day' : 'days'}
                </Text>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), accent]}>
                    {`${tasksCompletedToday} today`}
                </Text>
            </VStack>
            <VStack modifiers={[frame({ maxWidth: 10000, alignment: 'leading' }), padding({ leading: 4 })]}>
                <Text modifiers={[font({ weight: 'medium', size: 11 }), tertiary]}>
                    Last 7 days
                </Text>
                <Spacer />
                <HStack>
                    {levels.map((level, i) => (
                        <VStack key={i} modifiers={[frame({ maxWidth: 10000 })]}>
                            <Text
                                modifiers={[
                                    font({ size: 20, weight: 'bold', design: 'rounded' }),
                                    foregroundStyle(LEVEL_COLORS[Math.min(level, 4)]),
                                    cornerRadius(3),
                                ]}
                            >
                                ■
                            </Text>
                            <Text modifiers={[font({ size: 9 }), tertiary, padding({ top: 1 })]}>
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
