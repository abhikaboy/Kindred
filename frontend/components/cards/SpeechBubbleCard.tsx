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
    /** Custom header row rendered at the top of the bubble (category·task, "commented on your post", …). */
    header?: React.ReactNode;
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
    header,
    message,
    imageUri,
    videoUri,
    videoThumbnailUri,
    videoDurationMs,
    thumbnailUri,
    timeLabel,
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

    return (
        <Animated.View
            style={[styles.row, { opacity: bubbleOpacity, transform: [{ translateX: bubbleTranslateX }] }]}>
            <CardContainer
                testID="speech-bubble-card"
                style={styles.card}
                {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}>
                {!read ? <View testID="unread-dot" style={styles.unreadDot} /> : null}

                {/* Row 1: avatar + title, vertically centered together */}
                <View style={styles.topRow}>
                    <Animated.View style={{ opacity: avatarOpacity }}>
                        <TouchableOpacity
                            onPress={onAvatarPress}
                            disabled={!onAvatarPress}
                            activeOpacity={0.7}>
                            <CachedImage
                                source={{ uri: sender.picture }}
                                fallbackSource={require("@/assets/images/head.png")}
                                variant="thumbnail"
                                cachePolicy="memory-disk"
                                style={styles.userAvatar}
                            />
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.headerRow}>
                        <View style={styles.headerContent}>{header}</View>
                        <ThemedText type="caption" style={styles.timeTextTopRight}>
                            {timeLabel}
                        </ThemedText>
                    </View>
                </View>

                {/* Row 2: name (under the avatar) + message, top-aligned */}
                <View style={styles.bottomRow}>
                    <View style={styles.nameCol}>
                        <ThemedText type="default" style={styles.userName} numberOfLines={1}>
                            {sender.name}
                        </ThemedText>
                    </View>

                    <View style={styles.bubbleBody}>
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

                        {footerSlot ? (
                            <View style={styles.footerRow}>
                                <View>{footerSlot}</View>
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
        topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        bottomRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 6 },
        userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ThemedColor.tertiary },
        nameCol: { width: 44, alignItems: "center" },
        userName: { color: ThemedColor.caption, fontSize: 11, textAlign: "center" },
        bubbleBody: { flex: 1 },
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
        headerRow: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },
        headerContent: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
        contentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
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
        timeTextTopRight: { color: ThemedColor.caption, fontSize: 12, flexShrink: 0, alignSelf: "flex-start" },
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
        footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 },
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
