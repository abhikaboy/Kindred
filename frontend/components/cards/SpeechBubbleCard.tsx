import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CachedImage from "@/components/CachedImage";

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

const TAIL_SIZE = 10;

export default function SpeechBubbleCard({
    sender,
    header,
    message,
    imageUri,
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
        <View style={styles.row}>
            <Animated.View style={{ opacity: avatarOpacity }}>
                <TouchableOpacity
                    style={styles.userSection}
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
                    <View style={styles.userInfo}>
                        <ThemedText type="default" style={styles.userName} numberOfLines={1}>
                            {sender.name}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            </Animated.View>

            <Animated.View
                style={[
                    styles.bubbleWrapper,
                    { opacity: bubbleOpacity, transform: [{ translateX: bubbleTranslateX }] },
                ]}>
                <View style={styles.bubbleTail} />

                <CardContainer
                    testID="speech-bubble-card"
                    style={styles.card}
                    {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}>
                    {!read ? <View testID="unread-dot" style={styles.unreadDot} /> : null}

                    {header || thumbnailUri ? (
                        <View style={styles.headerRow}>
                            <View style={styles.headerContent}>{header}</View>
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

                    <View style={styles.contentContainer}>
                        {imageUri ? (
                            <Image testID="bubble-image" source={{ uri: imageUri }} style={styles.image} />
                        ) : message ? (
                            <ThemedText type="lightBody" style={styles.messageText}>
                                {message}
                            </ThemedText>
                        ) : null}

                        {footerSlot ? (
                            <View style={styles.footerRow}>
                                <View>{footerSlot}</View>
                                <ThemedText type="caption" style={styles.timeTextInline}>
                                    {timeLabel}
                                </ThemedText>
                            </View>
                        ) : (
                            <ThemedText type="caption" style={styles.timeText}>
                                {timeLabel}
                            </ThemedText>
                        )}
                    </View>
                </CardContainer>
            </Animated.View>
        </View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        row: { flexDirection: "row", alignItems: "flex-start" },
        userSection: { alignItems: "center", gap: 6 },
        userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ThemedColor.tertiary },
        userInfo: { width: 52 },
        userName: { color: ThemedColor.caption, fontSize: 11, textAlign: "center" },
        bubbleWrapper: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
        bubbleTail: {
            width: 0,
            height: 0,
            borderTopWidth: TAIL_SIZE,
            borderBottomWidth: TAIL_SIZE,
            borderRightWidth: TAIL_SIZE,
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            borderRightColor: ThemedColor.background,
            marginTop: 4,
        },
        card: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            borderWidth: 0.5,
            borderColor: ThemedColor.tertiary,
            borderRadius: 14,
            borderTopLeftRadius: 8,
            padding: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 1,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
        },
        headerContent: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
        thumbnail: { width: 40, height: 40, borderRadius: 6 },
        contentContainer: { marginTop: 2, width: "100%" },
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
        timeText: { color: ThemedColor.caption, fontSize: 12, marginTop: 10 },
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
        timeTextInline: { color: ThemedColor.caption, fontSize: 12 },
    });
