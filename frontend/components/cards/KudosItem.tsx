import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import ReactionTray from "@/components/cards/ReactionTray";
import type { KudosReactionEmoji } from "@/constants/kudos";

interface KudosSender {
    name: string;
    picture: string;
    id: string;
}

interface KudosData {
    id: string;
    sender: KudosSender;
    message: string;
    scope?: string;
    categoryName?: string;
    taskName?: string;
    timestamp: string;
    read: boolean;
    type?: string;
    thumbnailUrl?: string | null;
    durationMs?: number | null;
    reaction?: string | null;
    reactedAt?: string;
}

interface KudosItemProps {
    kudos: KudosData;
    formatTime: (timestamp: string) => string;
    visible?: boolean;
    index?: number;
    onReact?: (id: string, emoji: string) => void;
    /** Optional content rendered in the bubble footer (e.g. an action button). */
    footerSlot?: React.ReactNode;
}

export default function KudosItem({
    kudos,
    formatTime,
    visible = false,
    index = 0,
    onReact,
    footerSlot,
}: KudosItemProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const router = useRouter();
    const [trayOpen, setTrayOpen] = useState(false);

    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const isImage = kudos.type === "image";
    const isVideo = kudos.type === "video" && !!kudos.thumbnailUrl;
    const isProfileLevel = kudos.scope === "profile";
    const hasReaction = Boolean(kudos.reaction);

    const triggerPulse = () => {
        scale.value = withSequence(withSpring(1.35, { damping: 10 }), withSpring(1, { damping: 14 }));
    };

    const handleTap = () => {
        if (!onReact) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        triggerPulse();
        onReact(kudos.id, "❤️");
    };

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTrayOpen(true);
    };

    const handleSelectEmoji = (emoji: KudosReactionEmoji) => {
        if (!onReact) return;
        triggerPulse();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReact(kudos.id, emoji);
    };

    const reactionButton = onReact ? (
        <View style={styles.reactionRow}>
            <Pressable onPress={handleTap} onLongPress={handleLongPress} hitSlop={8}>
                <Animated.View style={animatedStyle}>
                    {hasReaction ? (
                        <Text style={styles.reactionEmoji}>{kudos.reaction}</Text>
                    ) : (
                        <Heart
                            size={18}
                            color={ThemedColor.caption}
                            weight="regular"
                        />
                    )}
                </Animated.View>
            </Pressable>
            <ReactionTray
                visible={trayOpen}
                currentReaction={kudos.reaction}
                onSelect={handleSelectEmoji}
                onDismiss={() => setTrayOpen(false)}
            />
        </View>
    ) : null;

    const header = isProfileLevel ? (
        <ThemedText type="defaultSemiBold" style={styles.categoryText}>
            Profile Encouragement 🎉
        </ThemedText>
    ) : (
        <>
            <ThemedText type="defaultSemiBold" style={styles.categoryText} numberOfLines={1}>
                {kudos.categoryName}
            </ThemedText>
            <View style={styles.dot} />
            <ThemedText type="default" style={styles.taskName} numberOfLines={1}>
                {kudos.taskName}
            </ThemedText>
        </>
    );

    return (
        <SpeechBubbleCard
            sender={kudos.sender}
            header={header}
            message={isImage || isVideo ? undefined : kudos.message}
            imageUri={isImage ? kudos.message : undefined}
            videoUri={isVideo ? kudos.message : undefined}
            videoThumbnailUri={isVideo ? kudos.thumbnailUrl ?? undefined : undefined}
            videoDurationMs={isVideo ? kudos.durationMs ?? undefined : undefined}
            timeLabel={formatTime(kudos.timestamp)}
            read={kudos.read}
            footerSlot={footerSlot ?? reactionButton}
            onAvatarPress={() => router.push(`/account/${kudos.sender.id}`)}
            visible={visible}
            index={index}
        />
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        categoryText: { color: ThemedColor.text, fontSize: 15, flexShrink: 1 },
        dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: ThemedColor.caption, flexShrink: 0 },
        taskName: { color: ThemedColor.text, fontSize: 15, flexShrink: 1 },
        reactionRow: {
            alignSelf: "flex-end",
            marginTop: 4,
        },
        reactionEmoji: {
            fontSize: 18,
        },
    });
