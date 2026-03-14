'widget';

import React from 'react';
import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, WidgetBase } from 'expo-widgets';

const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

// --- Circular: today completion ring ---

export type LockScreenCircularProps = {
    completedCount: number;
    totalCount: number;
};

const LockScreenCircularComponent = (props: WidgetBase<LockScreenCircularProps>) => {
    'widget';
    const { completedCount, totalCount } = props;
    const label = totalCount > 0 ? `${completedCount}/${totalCount}` : '—';
    return (
        <VStack>
            <Text modifiers={[font({ weight: 'bold', size: 14, design: 'rounded' }), primary]}>
                {label}
            </Text>
            <Text modifiers={[font({ size: 9 }), secondary]}>
                tasks
            </Text>
        </VStack>
    );
};

export const LockScreenCircularWidget = createWidget('LockScreenCircularWidget', LockScreenCircularComponent);

// --- Rectangular: next due task ---

export type LockScreenRectangularProps = {
    taskTitle: string;
    dueTime: string;
};

const LockScreenRectangularComponent = (props: WidgetBase<LockScreenRectangularProps>) => {
    'widget';
    const { taskTitle, dueTime } = props;
    return (
        <VStack modifiers={[padding({ horizontal: 4 })]}>
            <Text modifiers={[font({ weight: 'semibold', size: 13 }), primary]}>
                {taskTitle || 'No upcoming tasks'}
            </Text>
            {taskTitle ? (
                <Text modifiers={[font({ size: 11 }), secondary]}>
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
        <Text modifiers={[font({ weight: 'medium', size: 12 }), primary]}>
            {`🔥 ${streak} day streak`}
        </Text>
    );
};

export const LockScreenInlineWidget = createWidget('LockScreenInlineWidget', LockScreenInlineComponent);

export default LockScreenCircularWidget;
