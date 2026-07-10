import React, { useMemo, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { router, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { Heart, PaperPlaneTilt, Play } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import NotificationCard, {
    ActionCircle,
    FooterRow,
    SentenceBold,
    SentenceFocus,
    SentenceText,
} from "@/components/notifications/NotificationCard";
import ReactionTray from "@/components/cards/ReactionTray";
import KudosVideoPlayerModal from "@/components/modals/KudosVideoPlayerModal";
import { useKudosOptional } from "@/contexts/kudosContext";
import { formatVideoDuration } from "@/api/media";
import { KUDOS_HEART_EMOJI, type KudosReactionEmoji } from "@/constants/kudos";

type Props = {
    name: string;
    userId: string;
    taskName: string;
    message?: string;
    icon: string;
    time: number;
    // Task ID for encouragements / Post ID for congratulations. Empty string
    // for profile-scope kudos (e.g. ring encouragements) where there's no
    // task to deep-link to.
    referenceId: string;
    /** Kudos video thumbnail (notification.thumbnail / TaskKudos.thumbnailUrl). */
    thumbnail?: string;
    /** Video length when the source carries it (TaskKudos.durationMs). */
    durationMs?: number;
    type?: "encouragement" | "congratulation";
};

type MediaPreviewProps = {
    imageUri?: string;
    videoUri?: string;
    videoThumbnailUri?: string;
    durationMs?: number;
};

// Rounded media body for image/video kudos; video opens fullscreen playback.
const KudosMediaPreview = ({ imageUri, videoUri, videoThumbnailUri, durationMs }: MediaPreviewProps) => {
    const [playerOpen, setPlayerOpen] = useState(false);

    if (videoUri && videoThumbnailUri) {
        return (
            <>
                <TouchableOpacity testID="bubble-video" onPress={() => setPlayerOpen(true)} activeOpacity={0.85}>
                    <Image source={{ uri: videoThumbnailUri }} style={styles.media} />
                    <View style={styles.playOverlay}>
                        <Play size={32} color="#fff" weight="fill" />
                    </View>
                    {durationMs ? (
                        <View style={styles.durationPill}>
                            <ThemedText type="caption" style={styles.durationText}>
                                {formatVideoDuration(durationMs)}
                            </ThemedText>
                        </View>
                    ) : null}
                </TouchableOpacity>
                {playerOpen ? <KudosVideoPlayerModal uri={videoUri} onClose={() => setPlayerOpen(false)} /> : null}
            </>
        );
    }
    if (imageUri) {
        return <Image testID="bubble-image" source={{ uri: imageUri }} style={styles.media} />;
    }
    return null;
};

type ReactActionProps = {
    reaction?: string | null;
    onReact: (emoji: KudosReactionEmoji) => void;
};

// Reaction circle — tap opens the tray; the reaction only sends on tray selection.
const ReactAction = ({ reaction, onReact }: ReactActionProps) => {
    const ThemedColor = useThemeColor();
    const [trayOpen, setTrayOpen] = useState(false);

    const handleTap = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTrayOpen(true);
    };

    const handleSelect = (emoji: KudosReactionEmoji) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReact(emoji);
    };

    return (
        <>
            <ActionCircle testID="kudos-reaction-button" label="React to kudos" onPress={handleTap}>
                {reaction === KUDOS_HEART_EMOJI ? (
                    <Heart size={20} color={ThemedColor.error} weight="fill" />
                ) : reaction ? (
                    <ThemedText type="default" style={styles.reactionEmoji}>
                        {reaction}
                    </ThemedText>
                ) : (
                    <Heart size={20} color={ThemedColor.text} />
                )}
            </ActionCircle>
            <ReactionTray
                visible={trayOpen}
                currentReaction={reaction}
                onSelect={handleSelect}
                onDismiss={() => setTrayOpen(false)}
            />
        </>
    );
};

const UserInfoEncouragementNotification = ({
    name,
    userId,
    taskName,
    message,
    icon,
    time,
    referenceId,
    thumbnail,
    durationMs,
    type = "encouragement",
}: Props) => {
    const ThemedColor = useThemeColor();
    const kudosCtx = useKudosOptional();
    const isCongrats = type === "congratulation";
    // Notification content carries no kudos type, so a media kudos arrives as its URL
    // in `message`. Backend sets `thumbnail` only for videos — that's the video signal
    // (extension sniffing fails on extension-less CDN urls).
    const isMediaUrl = !!message && /^https?:\/\//i.test(message.trim());
    const isVideo = isMediaUrl && !!thumbnail;
    const isImage = isMediaUrl && !thumbnail;
    // Profile-scope (ring) encouragements arrive with no taskName and no referenceId.
    const isProfileScope = !referenceId && !taskName;

    // The notification row doesn't carry the kudos document ID, so match it back to the
    // received kudos (sender + message, nearest in time) to enable reacting in place.
    const pool = isCongrats ? kudosCtx?.congratulations : kudosCtx?.encouragements;
    const matched = useMemo(() => {
        if (!pool) return undefined;
        const candidates = pool.filter((k) => k.sender.id === userId && (!message || k.message === message));
        if (candidates.length === 0) return undefined;
        return candidates.reduce((best, k) =>
            Math.abs(new Date(k.timestamp).getTime() - time) < Math.abs(new Date(best.timestamp).getTime() - time)
                ? k
                : best,
        );
    }, [pool, userId, message, time]);

    const handlePress = () => {
        router.push(`/account/${userId}` as Href);
    };

    const handleReact = useMemo(() => {
        if (!matched || !kudosCtx) return undefined;
        return (emoji: string) =>
            isCongrats
                ? kudosCtx.reactToCongratulation(matched.id, emoji)
                : kudosCtx.reactToEncouragement(matched.id, emoji);
    }, [matched, kudosCtx, isCongrats]);

    const showTask = !isProfileScope && !!taskName;
    // Text kudos flow inline, Venmo-style: ... for **Task**: "message"
    const textMessage = message && !isMediaUrl ? message : undefined;
    const sentence = (
        <SentenceText>
            <SentenceBold>{name}</SentenceBold>
            {isCongrats ? " congratulated you" : " sent you encouragement"}
            {showTask ? (isCongrats ? " on " : " for ") : ""}
            {showTask ? <SentenceBold>{taskName}</SentenceBold> : null}
            {textMessage ? ": " : ""}
            {textMessage ? <SentenceFocus>{`"${textMessage}"`}</SentenceFocus> : null}
        </SentenceText>
    );

    const body =
        isImage || isVideo ? (
            <KudosMediaPreview
                imageUri={isImage ? message!.trim() : undefined}
                videoUri={isVideo ? message!.trim() : undefined}
                videoThumbnailUri={isVideo ? thumbnail : undefined}
                durationMs={isVideo ? durationMs : undefined}
            />
        ) : undefined;

    const footer = (
        <FooterRow>
            {handleReact ? <ReactAction reaction={matched?.reaction} onReact={handleReact} /> : null}
            <ActionCircle label={`Send kudos back to ${name}`} caption="Send kudos back" onPress={handlePress}>
                <PaperPlaneTilt size={20} color={ThemedColor.text} />
            </ActionCircle>
        </FooterRow>
    );

    return (
        <NotificationCard time={time} icon={icon} userId={userId} sentence={sentence} footer={footer}>
            {body}
        </NotificationCard>
    );
};

export default UserInfoEncouragementNotification;

const styles = StyleSheet.create({
    // Media is the hero of the card: full width, generous ~16:10 frame.
    media: {
        width: "100%",
        aspectRatio: 16 / 10,
        borderRadius: 16,
        resizeMode: "cover",
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    durationPill: {
        position: "absolute",
        bottom: 8,
        right: 8,
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    durationText: { color: "#fff", fontSize: 12 },
    reactionEmoji: { fontSize: 18 },
});
