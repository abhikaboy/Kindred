import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Heart } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import ReactionTray from "@/components/cards/ReactionTray";
import { KUDOS_HEART_EMOJI, type KudosReactionEmoji } from "@/constants/kudos";

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
    /** Verb phrase woven after the sender's name ("sent you encouragement"). */
    title?: string;
    /** Optional content rendered in the bubble footer (e.g. an action button). */
    footerSlot?: React.ReactNode;
    /** Optional avatar-corner badge (notification type cue), passed through to the bubble. */
    badge?: React.ReactNode;
}

export default function KudosItem({
    kudos,
    formatTime,
    visible = false,
    index = 0,
    onReact,
    title = "sent you encouragement",
    footerSlot,
    badge,
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
    const isHeartReaction = kudos.reaction === KUDOS_HEART_EMOJI;

    const triggerPulse = () => {
        // Plain timing — a spring overshoots and the icon visibly bounces (matches the tray)
        scale.value = withSequence(withTiming(1.2, { duration: 120 }), withTiming(1, { duration: 130 }));
    };

    // Tapping only opens the tray — the reaction is sent on tray selection,
    // never on the tap itself.
    const handleTap = () => {
        if (!onReact) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            <Pressable testID="kudos-reaction-button" onPress={handleTap} hitSlop={8}>
                <Animated.View style={animatedStyle}>
                    {isHeartReaction ? (
                        <Heart
                            testID="kudos-reaction-heart-filled"
                            size={18}
                            color={ThemedColor.error}
                            weight="fill"
                        />
                    ) : hasReaction ? (
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

    // category·task sits under the title as a secondary line; profile-scope kudos
    // have neither, so they show just the woven title.
    const hasContext = !isProfileLevel && (!!kudos.categoryName || !!kudos.taskName);
    const context = hasContext ? (
        <>
            {kudos.categoryName ? (
                <>
                    <ThemedText type="defaultSemiBold" style={styles.categoryText} numberOfLines={1}>
                        {kudos.categoryName}
                    </ThemedText>
                    {kudos.taskName ? <View style={styles.dot} /> : null}
                </>
            ) : null}
            {kudos.taskName ? (
                <ThemedText type="default" style={styles.taskName} numberOfLines={1}>
                    {kudos.taskName}
                </ThemedText>
            ) : null}
        </>
    ) : undefined;

    // A custom footer (e.g. "Send kudos back") and the reaction button can coexist.
    const footer =
        footerSlot && reactionButton ? (
            <View style={styles.footerSplit}>
                <View>{footerSlot}</View>
                {reactionButton}
            </View>
        ) : (
            footerSlot ?? reactionButton
        );

    return (
        <SpeechBubbleCard
            sender={kudos.sender}
            title={title}
            context={context}
            message={isImage || isVideo ? undefined : kudos.message}
            imageUri={isImage ? kudos.message : undefined}
            videoUri={isVideo ? kudos.message : undefined}
            videoThumbnailUri={isVideo ? kudos.thumbnailUrl ?? undefined : undefined}
            videoDurationMs={isVideo ? kudos.durationMs ?? undefined : undefined}
            timeLabel={formatTime(kudos.timestamp)}
            read={kudos.read}
            badge={badge}
            footerSlot={footer}
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
        footerSplit: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },
    });
