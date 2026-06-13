import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CachedImage from "@/components/CachedImage";
import { Play } from "phosphor-react-native";
import KudosVideoPlayerModal from "@/components/modals/KudosVideoPlayerModal";
import { formatVideoDuration } from "@/api/media";

export interface SpeechBubbleSender {
    name: string;
    picture: string;
    id: string;
}

export interface SpeechBubbleCardProps {
    sender: SpeechBubbleSender;
    /** Verb phrase woven after the bold name on the title line ("commented on your post"). */
    title?: string;
    /** Caption word before the name ("To" for sent kudos). */
    namePrefix?: string;
    /** Secondary line under the title (kudos category·task). */
    context?: React.ReactNode;
    /** The "speech" text. Ignored when imageUri is set. */
    message?: string;
    /** Full-width inline image (image kudos). */
    imageUri?: string;
    /** Video kudos: tappable thumbnail that opens fullscreen playback. */
    videoUri?: string;
    /** Poster shown for videoUri (full-width, like imageUri). */
    videoThumbnailUri?: string;
    /** Clip length for the duration pill. */
    videoDurationMs?: number;
    /** Small rounded image in the bubble's top-right (e.g. comment post thumbnail). */
    thumbnailUri?: string;
    /** Pre-formatted time string — this component does not format time. */
    timeLabel: string;
    /** Small icon disc overlapping the avatar's bottom-right (notification type cue). */
    badge?: React.ReactNode;
    read?: boolean;
    /** Rendered in the footer row beside the timestamp (e.g. an action button). */
    footerSlot?: React.ReactNode;
    /** Whole-bubble tap target. */
    onPress?: () => void;
    /** Avatar tap target. */
    onAvatarPress?: () => void;
    /** Triggers the scroll-in animation. */
    visible?: boolean;
    index?: number;
}

export default function SpeechBubbleCard({
    sender,
    title,
    namePrefix,
    context,
    message,
    imageUri,
    videoUri,
    videoThumbnailUri,
    videoDurationMs,
    thumbnailUri,
    timeLabel,
    badge,
    read = true,
    footerSlot,
    onPress,
    onAvatarPress,
    visible = false,
    index = 0,
}: SpeechBubbleCardProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [playerOpen, setPlayerOpen] = useState(false);

    const bubbleTranslateX = useRef(new Animated.Value(-28)).current;
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const avatarOpacity = useRef(new Animated.Value(0)).current;
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!visible || hasAnimated.current) return;
        hasAnimated.current = true;
        const delay = Math.min(index * 120, 600);
        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(avatarOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(bubbleOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.spring(bubbleTranslateX, {
                    toValue: 0,
                    stiffness: 280,
                    damping: 26,
                    mass: 0.8,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [visible, index]);

    const CardContainer: React.ComponentType<any> = onPress ? TouchableOpacity : View;
    const hasBody = !!((videoUri && videoThumbnailUri) || imageUri || message || thumbnailUri);

    return (
        <Animated.View style={[styles.row, { opacity: bubbleOpacity, transform: [{ translateX: bubbleTranslateX }] }]}>
            <CardContainer
                testID="speech-bubble-card"
                style={styles.card}
                {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}>
                {!read ? <View testID="unread-dot" style={styles.unreadDot} /> : null}

                <View style={styles.body}>
                    <Animated.View style={{ opacity: avatarOpacity }}>
                        <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress} activeOpacity={0.7}>
                            <CachedImage
                                source={{ uri: sender.picture }}
                                fallbackSource={require("@/assets/images/head.png")}
                                variant="thumbnail"
                                cachePolicy="memory-disk"
                                style={styles.userAvatar}
                            />
                            {badge ? (
                                <View testID="speech-bubble-badge" style={styles.badge}>
                                    {badge}
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.textColumn}>
                        {/* Title: bold name woven into the phrase, time pinned top-right. */}
                        <View style={styles.titleRow}>
                            <ThemedText type="default" style={styles.titleLine}>
                                {namePrefix ? (
                                    <ThemedText type="caption" style={styles.namePrefix}>
                                        {namePrefix}{" "}
                                    </ThemedText>
                                ) : null}
                                <ThemedText type="defaultSemiBold" style={styles.senderName}>
                                    {sender.name}
                                </ThemedText>
                                {title ? (
                                    <ThemedText type="default" style={styles.titlePhrase}>
                                        {" "}
                                        {title}
                                    </ThemedText>
                                ) : null}
                            </ThemedText>
                            <ThemedText type="caption" style={styles.timeText}>
                                {timeLabel}
                            </ThemedText>
                        </View>

                        {context ? <View style={styles.contextRow}>{context}</View> : null}

                        {hasBody ? (
                            <View style={styles.contentRow}>
                                <View style={styles.contentMain}>
                                    {videoUri && videoThumbnailUri ? (
                                        <TouchableOpacity
                                            testID="bubble-video"
                                            onPress={() => setPlayerOpen(true)}
                                            activeOpacity={0.85}>
                                            <Image source={{ uri: videoThumbnailUri }} style={styles.image} />
                                            <View style={styles.playOverlay}>
                                                <Play size={32} color="#fff" weight="fill" />
                                            </View>
                                            {videoDurationMs ? (
                                                <View style={styles.durationPill}>
                                                    <ThemedText type="caption" style={styles.durationText}>
                                                        {formatVideoDuration(videoDurationMs)}
                                                    </ThemedText>
                                                </View>
                                            ) : null}
                                        </TouchableOpacity>
                                    ) : imageUri ? (
                                        <Image testID="bubble-image" source={{ uri: imageUri }} style={styles.image} />
                                    ) : message ? (
                                        <ThemedText type="lightBody" style={styles.messageText}>
                                            {message}
                                        </ThemedText>
                                    ) : null}
                                </View>
                                {thumbnailUri ? (
                                    <CachedImage
                                        testID="bubble-thumbnail"
                                        source={{ uri: thumbnailUri }}
                                        variant="thumbnail"
                                        cachePolicy="memory-disk"
                                        style={styles.thumbnail}
                                    />
                                ) : null}
                            </View>
                        ) : null}

                        {footerSlot ? (
                            <View style={styles.footerRow}>
                                {/* flex: 1 lets footers span the row (e.g. CTA left, reaction right) */}
                                <View style={{ flex: 1 }}>{footerSlot}</View>
                            </View>
                        ) : null}
                    </View>
                </View>
            </CardContainer>
            {playerOpen && videoUri ? (
                <KudosVideoPlayerModal uri={videoUri} onClose={() => setPlayerOpen(false)} />
            ) : null}
        </Animated.View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        row: { flexDirection: "row", alignItems: "flex-start" },
        body: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
        textColumn: { flex: 1 },
        userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ThemedColor.tertiary },
        badge: {
            position: "absolute",
            bottom: -3,
            right: -3,
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ThemedColor.background,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2.5,
            elevation: 3,
        },
        titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
        titleLine: { flex: 1, fontSize: 15, lineHeight: 20, color: ThemedColor.text },
        senderName: { fontSize: 15, color: ThemedColor.text },
        titlePhrase: { fontSize: 15, color: ThemedColor.text },
        namePrefix: { fontSize: 15, color: ThemedColor.caption },
        contextRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 },
        card: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            padding: 12,
            paddingVertical: 16,
            borderWidth: 0.5,
            borderColor: ThemedColor.tertiary,
            borderRadius: 14,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 2,
        },
        contentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
        contentMain: { flex: 1 },
        thumbnail: { width: 40, height: 40, borderRadius: 6 },
        messageText: { color: ThemedColor.caption, fontSize: 15, lineHeight: 20 },
        image: {
            width: "100%",
            alignSelf: "flex-start",
            height: 200,
            maxHeight: Dimensions.get("window").height * 0.5,
            resizeMode: "contain",
            borderRadius: 8,
            marginBottom: 8,
        },
        timeText: { color: ThemedColor.caption, fontSize: 12, flexShrink: 0, alignSelf: "flex-start" },
        unreadDot: {
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: ThemedColor.error,
            zIndex: 1,
        },
        footerRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
            gap: 8,
        },
        playOverlay: {
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
        },
        durationPill: {
            position: "absolute",
            bottom: 16,
            right: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
        },
        durationText: { color: "#fff", fontSize: 12 },
    });
