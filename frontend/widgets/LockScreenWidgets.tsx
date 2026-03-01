'widget';

import React from 'react';
import { Text, VStack, HStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

// --- Circular: today completion ring ---

export type LockScreenCircularProps = {
    completedCount: number;
    totalCount: number;
};

const LockScreenCircularComponent = (props: WidgetBase<LockScreenCircularProps>) => {
    'widget';
    const { completedCount, totalCount } = props;
    const label = totalCount > 0 ? `${completedCount}/${totalCount}` : '0';
    return (
        <VStack>
            <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#8B5CF6')]}>
                {label}
            </Text>
            <Text modifiers={[font({ size: 9 }), foregroundStyle('#A0A0B0')]}>
                tasks
            </Text>
        </VStack>
    );
};

export const LockScreenCircularWidget = createWidget('LockScreenCircularWidget', LockScreenCircularComponent);

// --- Rectangular: next due task ---

export type LockScreenRectangularProps = {
    taskTitle: string;
    dueTime: string; // formatted string e.g. "3:00 PM" or "Today"
};

const LockScreenRectangularComponent = (props: WidgetBase<LockScreenRectangularProps>) => {
    'widget';
    const { taskTitle, dueTime } = props;
    return (
        <VStack modifiers={[padding({ horizontal: 4 })]}>
            <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#FFFFFF')]}>
                {taskTitle || 'No upcoming tasks'}
            </Text>
            {taskTitle ? (
                <Text modifiers={[font({ size: 11 }), foregroundStyle('#A0A0B0')]}>
                    {`Due ${dueTime}`}
                </Text>
            ) : null}
        </VStack>
    );
};

export const LockScreenRectangularWidget = createWidget('LockScreenRectangularWidget', LockScreenRectangularComponent);

// --- Inline: streak count ---

export type LockScreenInlineProps = {
    streak: number;
};

const LockScreenInlineComponent = (props: WidgetBase<LockScreenInlineProps>) => {
    'widget';
    const { streak } = props;
    return (
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#8B5CF6')]}>
            {`🔥 ${streak} day streak`}
        </Text>
    );
};

export const LockScreenInlineWidget = createWidget('LockScreenInlineWidget', LockScreenInlineComponent);

export default LockScreenCircularWidget;
