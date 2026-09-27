'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Link, ZStack, Circle } from '@expo/ui/swift-ui';
import {
    background,
    font,
    foregroundStyle,
    frame,
    lineLimit,
    multilineTextAlignment,
    monospacedDigit,
    padding,
    resizable,
    shapes,
    tint,
    widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type DeadlineCountdownProps = {
    taskName: string;
    workspaceName: string;
    deadline: string;
    priority: number;
    categoryId: string;
    taskId: string;
    /** File URL of the Kindred check in the app group, set by liveActivityManager. */
    brandMarkUri?: string;
    /** Set by liveActivityManager.deadlineStatus as the deadline approaches. */
    accentColor: string;
    statusLabel: string;
};

const DeadlineCountdownComponent = (props: DeadlineCountdownProps) => {
    'widget';

    // Matches the app's dark surface and the widgets' Outfit type (weights by instance name)
    const BG = '#0C0C1A';
    const BRAND = '#854DFF';
    const SOFT = '#B89BFF';
    const WHITE = '#FFFFFF';
    const MUTED = '#FFFFFF8C';
    const TRACK = '#FFFFFF1F';
    const LIGHT = 'Outfit-Thin_Light';
    const REGULAR = 'Outfit-Thin_Regular';
    const MEDIUM = 'Outfit-Thin_Medium';

    const { brandMarkUri, taskName, workspaceName, deadline, categoryId, taskId, accentColor, statusLabel } = props;
    const accent = accentColor || SOFT;
    const timerDate = new Date(deadline);
    const overdue = statusLabel === 'Overdue';
    const status = statusLabel;
    // Empties over the final hour before the deadline
    const progress = overdue ? null : (
        <ProgressView
            timerInterval={{ lower: new Date(timerDate.getTime() - 60 * 60 * 1000), upper: timerDate }}
            countsDown={true}
            modifiers={[tint(accent)]}
        />
    );
    const context = <Text modifiers={[font({ family: LIGHT, size: 12 }), foregroundStyle(MUTED), lineLimit(1)]}>{workspaceName}</Text>;

    const base = `kindred:///(logged-in)/(tabs)/(task)/task/${taskId}?categoryId=${categoryId}&name=${encodeURIComponent(taskName)}`;
    const completeLink = `${base}&action=complete`;
    const dismissLink = `${base}&action=dismiss`;

    // The Kindred check from the logged-out screen
    const mark = (height: number) =>
        brandMarkUri ? (
            <Image uiImage={brandMarkUri} modifiers={[resizable(), frame({ width: height * 1.24, height })]} />
        ) : (
            <Image systemName="checkmark" color={BRAND} size={height} />
        );

    const statusRow = (
        <HStack spacing={6} alignment="center">
            {mark(11)}
            <Text modifiers={[font({ family: MEDIUM, size: 12 }), foregroundStyle(accent)]}>{status}</Text>
            {context}
        </HStack>
    );

    const timer = (size: number) => (
        <Text
            date={timerDate}
            dateStyle="timer"
            modifiers={[font({ family: REGULAR, size }), monospacedDigit(), foregroundStyle(WHITE), lineLimit(1), multilineTextAlignment('leading'), frame({ maxWidth: 9999, alignment: 'leading' })]}
        />
    );

    const actions = (
        <HStack spacing={8}>
            <Link destination={dismissLink}>
                <ZStack modifiers={[frame({ width: 36, height: 36 })]}>
                    <Circle modifiers={[foregroundStyle(TRACK)]} />
                    <Image systemName="xmark" color={MUTED} size={12} />
                </ZStack>
            </Link>
            <Link destination={completeLink}>
                <HStack spacing={6} modifiers={[padding({ horizontal: 14 }), frame({ height: 36 }), background(BRAND, shapes.capsule())]}>
                    <Image systemName="checkmark" color={WHITE} size={12} />
                    <Text modifiers={[font({ family: MEDIUM, size: 14 }), foregroundStyle(WHITE)]}>Done</Text>
                </HStack>
            </Link>
        </HStack>
    );

    const main = (timerSize: number) => (
        <HStack alignment="bottom" spacing={12}>
            <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: 9999, alignment: 'leading' })]}>
                <Text modifiers={[font({ family: REGULAR, size: 16 }), foregroundStyle(WHITE), lineLimit(1)]}>{taskName}</Text>
                {timer(timerSize)}
            </VStack>
            <VStack modifiers={[padding({ bottom: 6 })]}>{actions}</VStack>
        </HStack>
    );

    return {
        banner: (
            <VStack
                alignment="leading"
                spacing={10}
                modifiers={[padding({ horizontal: 20, vertical: 16 }), frame({ maxWidth: 9999, alignment: 'leading' }), background(BG), widgetURL(base)]}
            >
                {statusRow}
                {main(38)}
                {progress}
            </VStack>
        ),
        compactLeading: mark(14),
        compactTrailing: (
            <Text
                date={timerDate}
                dateStyle="timer"
                modifiers={[font({ family: MEDIUM, size: 14 }), monospacedDigit(), foregroundStyle(accent), frame({ width: 52, alignment: 'trailing' })]}
            />
        ),
        minimal: mark(14),
        expandedLeading: <VStack modifiers={[padding({ leading: 8, top: 6 })]}>{statusRow}</VStack>,
        expandedBottom: (
            <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 8, bottom: 8 })]}>
                {main(32)}
                {progress}
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
