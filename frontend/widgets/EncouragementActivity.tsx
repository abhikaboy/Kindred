'widget';

import React from 'react';
import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type EncouragementActivityProps = {
    senderName: string;
    taskName: string;
    message: string;
    kudosEarned: number;
    type: 'encouragement' | 'congratulation';
};

const EncouragementActivityComponent = (props: EncouragementActivityProps) => {
    'widget';

    const { senderName, taskName, message, kudosEarned, type } = props;
    const isEncouragement = type === 'encouragement';
    const verb = isEncouragement ? 'encouraged you on' : 'congratulated you on';
    const systemIcon = isEncouragement ? 'hand.thumbsup.fill' : 'star.fill';
    const accentColor = isEncouragement ? '#8B5CF6' : '#F59E0B';

    return {
        banner: (
            <VStack modifiers={[padding({ all: 12 })]}>
                <HStack>
                    <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#FFFFFF')]}>
                        {`${senderName} ${verb}`}
                    </Text>
                    <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(accentColor)]}>
                        {`+${kudosEarned} kudos`}
                    </Text>
                </HStack>
                <Text modifiers={[font({ size: 13 }), foregroundStyle('#A0A0B0')]}>
                    {taskName}
                </Text>
                {message ? (
                    <Text modifiers={[font({ size: 12 }), foregroundStyle('#D0D0E0')]}>
                        {`"${message}"`}
                    </Text>
                ) : null}
            </VStack>
        ),
        compactLeading: (
            <Image systemName="person.fill" color={accentColor} />
        ),
        compactTrailing: (
            <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(accentColor)]}>
                {`+${kudosEarned}`}
            </Text>
        ),
        minimal: (
            <Image systemName={systemIcon} color={accentColor} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="person.fill" color={accentColor} />
                <Text modifiers={[font({ size: 10 }), foregroundStyle('#A0A0B0')]}>
                    {senderName}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(accentColor)]}>
                    {`+${kudosEarned}`}
                </Text>
                <Text modifiers={[font({ size: 10 }), foregroundStyle('#A0A0B0')]}>
                    kudos
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#FFFFFF')]}>
                    {taskName}
                </Text>
                {message ? (
                    <Text modifiers={[font({ size: 12 }), foregroundStyle('#D0D0E0')]}>
                        {`"${message}"`}
                    </Text>
                ) : null}
            </VStack>
        ),
    };
};

export default createLiveActivity('EncouragementActivity', EncouragementActivityComponent);
