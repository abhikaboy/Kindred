'widget';

import React from 'react';
import { Text, VStack, HStack, Image } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, frame, cornerRadius, backgroundOverlay, clipShape, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type EncouragementActivityProps = {
    senderName: string;
    taskName: string;
    message: string;
    kudosEarned: number;
    type: 'encouragement' | 'congratulation';
    messageType: 'message' | 'image';
};

const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

const EncouragementActivityComponent = (props: EncouragementActivityProps) => {
    'widget';

    const { senderName, taskName, message, kudosEarned, type, messageType } = props;
    const isEncouragement = type === 'encouragement';
    const verb = isEncouragement ? 'encouraged you on' : 'congratulated you on';
    const systemIcon = isEncouragement ? 'hand.thumbsup.fill' : 'star.fill';
    const accentColor = isEncouragement ? '#8B5CF6' : '#F59E0B';
    const isImage = messageType === 'image';

    const displayMessage = isImage ? 'Sent you a photo' : message;

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 })]}>
                <HStack>
                    <Image systemName={systemIcon} color={accentColor} size={14} />
                    <Text modifiers={[font({ weight: 'semibold', size: 15 }), primary]}>
                        {senderName}
                    </Text>
                    <Text modifiers={[font({ weight: 'bold', size: 13, design: 'rounded' }), foregroundStyle(accentColor)]}>
                        {`+${kudosEarned}`}
                    </Text>
                </HStack>
                {taskName ? (
                    <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>
                        {`${isEncouragement ? 'Encouraged' : 'Congratulated'} you on ${taskName}`}
                    </Text>
                ) : null}
                {displayMessage ? (
                    <HStack>
                        {isImage ? (
                            <Image systemName="photo.fill" color={accentColor} size={12} />
                        ) : null}
                        <Text modifiers={[font({ size: 13, design: isImage ? 'default' : 'default' }), isImage ? foregroundStyle(accentColor) : tertiary, lineLimit(2)]}>
                            {isImage ? displayMessage : `"${displayMessage}"`}
                        </Text>
                    </HStack>
                ) : null}
            </VStack>
        ),
        compactLeading: (
            <Image systemName={systemIcon} color={accentColor} />
        ),
        compactTrailing: (
            <Text modifiers={[font({ weight: 'bold', size: 12, design: 'rounded' }), foregroundStyle(accentColor)]}>
                {`+${kudosEarned}`}
            </Text>
        ),
        minimal: (
            <Image systemName={systemIcon} color={accentColor} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName={systemIcon} color={accentColor} size={22} />
                <Text modifiers={[font({ weight: 'medium', size: 11 }), secondary, lineLimit(1)]}>
                    {senderName}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text modifiers={[font({ weight: 'bold', size: 22, design: 'rounded' }), foregroundStyle(accentColor)]}>
                    {`+${kudosEarned}`}
                </Text>
                <Text modifiers={[font({ size: 11 }), secondary]}>
                    kudos
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 14 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                {displayMessage ? (
                    <HStack>
                        {isImage ? (
                            <Image systemName="photo.fill" color={accentColor} size={12} />
                        ) : null}
                        <Text modifiers={[font({ size: 13 }), isImage ? foregroundStyle(accentColor) : secondary, lineLimit(2)]}>
                            {isImage ? displayMessage : `"${displayMessage}"`}
                        </Text>
                    </HStack>
                ) : null}
            </VStack>
        ),
    };
};

export default createLiveActivity('EncouragementActivity', EncouragementActivityComponent);
