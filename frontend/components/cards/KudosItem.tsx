import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CachedImage from "@/components/CachedImage";
import { useRouter } from "expo-router";

interface KudosSender {
    name: string;
    picture: string;
    id: string;
}

interface KudosData {
    id: string;
    sender: KudosSender;
    message: string;
    scope?: string; // "task" or "profile" (optional for backwards compatibility)
    categoryName?: string;
    taskName?: string;
    timestamp: string;
    read: boolean;
    type?: string; // "message" or "image" (optional for backwards compatibility)
}

interface KudosItemProps {
    kudos: KudosData;
    formatTime: (timestamp: string) => string;
    visible?: boolean; // triggers animation when item scrolls into view
    index?: number;
}

export default function KudosItem({ kudos, formatTime, visible = false, index = 0 }: KudosItemProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const router = useRouter();

    const isImage = kudos.type === "image";
    const isProfileLevel = kudos.scope === "profile";

    const bubbleTranslateY = useRef(new Animated.Value(22)).current;
    const bubbleTranslateX = useRef(new Animated.Value(-10)).current;
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const avatarOpacity = useRef(new Animated.Value(0)).current;

    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!visible || hasAnimated.current) return;
        hasAnimated.current = true;

        const baseStagger = index * 180;
        const jitter = Math.floor(Math.random() * 100);
        // Cap so item 6+ doesn't wait more than ~700ms
        const delay = Math.min(baseStagger + jitter, 700);

        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(avatarOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(bubbleOpacity, {
                    toValue: 1,
                    duration: 260,
                    useNativeDriver: true,
                }),
                Animated.spring(bubbleTranslateY, {
                    toValue: 0,
                    tension: 90,
                    friction: 12,
                    useNativeDriver: true,
                }),
                Animated.spring(bubbleTranslateX, {
                    toValue: 0,
                    tension: 100,
                    friction: 14,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [visible]);

    const handleAvatarPress = () => {
        router.push(`/account/${kudos.sender.id}` as any);
    };

    return (
        <View style={styles.kudosItem}>
            {/* User Avatar and Name */}
            <Animated.View style={{ opacity: avatarOpacity }}>
                <TouchableOpacity style={styles.userSection} onPress={handleAvatarPress} activeOpacity={0.7}>
                    <CachedImage
                        source={{ uri: kudos.sender.picture }}
                        fallbackSource={require("@/assets/images/head.png")}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                        style={styles.userAvatar}
                    />
                    <View style={styles.userInfo}>
                        <ThemedText type="default" style={styles.userName}>
                            {kudos.sender.name}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            </Animated.View>

            {/* Speech bubble wrapper: triangle + card */}
            <Animated.View
                style={[
                    styles.bubbleWrapper,
                    {
                        opacity: bubbleOpacity,
                        transform: [
                            { translateX: bubbleTranslateX },
                            { translateY: bubbleTranslateY },
                        ],
                    },
                ]}
            >
                {/* Triangle tail pointing left toward the avatar */}
                <View style={styles.bubbleTail} />

                {/* Kudos Card */}
                <View style={styles.kudosCard}>
                    {/* Unread Indicator */}
                    {!kudos.read && <View style={styles.unreadDot} />}

                    {/* Task Info or Profile Label */}
                    {isProfileLevel ? (
                        <View style={styles.taskInfo}>
                            <ThemedText type="default" style={styles.categoryText}>
                                Profile Encouragement 🎉
                            </ThemedText>
                        </View>
                    ) : (
                        <View style={styles.taskInfo}>
                            <ThemedText type="default" style={styles.categoryText} numberOfLines={1}>
                                {kudos.categoryName}
                            </ThemedText>
                            <View style={styles.dot} />
                            <ThemedText
                                type="default"
                                style={{ ...styles.taskName, color: ThemedColor.primary }}
                                numberOfLines={1}
                            >
                                {kudos.taskName}
                            </ThemedText>
                        </View>
                    )}

                    {/* Message or Image */}
                    <View style={styles.contentContainer}>
                        {isImage ? (
                            <Image
                                source={{ uri: kudos.message }}
                                style={styles.kudosImage}
                            />
                        ) : (
                            <ThemedText type="lightBody" style={styles.messageText}>
                                {kudos.message}
                            </ThemedText>
                        )}
                        <ThemedText type="caption" style={styles.timeText}>
                            {formatTime(kudos.timestamp)}
                        </ThemedText>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

const TAIL_SIZE = 10;

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        kudosItem: {
            flexDirection: "row",
            alignItems: "flex-start",
        },
        userSection: {
            alignItems: "center",
            gap: 6,
        },
        userAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: ThemedColor.tertiary,
        },
        userInfo: {
            width: 52,
        },
        userName: {
            color: ThemedColor.caption,
            fontSize: 11,
            textAlign: "center",
        },
        bubbleWrapper: {
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-start",
        },
        // CSS triangle pointing left — zero-size box with only right border visible
        bubbleTail: {
            width: 0,
            height: 0,
            borderTopWidth: TAIL_SIZE,
            borderBottomWidth: TAIL_SIZE,
            borderRightWidth: TAIL_SIZE,
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            borderRightColor: ThemedColor.lightenedCard,
            marginTop: 4,
        },
        kudosCard: {
            flex: 1,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 14,
            borderTopLeftRadius: 8,
            padding: 14,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
        },
        taskInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
            flexWrap: "wrap",
        },
        categoryText: {
            color: ThemedColor.primary,
            fontSize: 15,
            fontWeight: "600",
            flexShrink: 1,
        },
        dot: {
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: ThemedColor.caption,
            flexShrink: 0,
        },
        taskName: {
            color: ThemedColor.text,
            fontSize: 15,
            flexShrink: 1,
        },
        contentContainer: {
            marginTop: 2,
            width: "100%",
        },
        messageText: {
            color: ThemedColor.text,
            fontSize: 16,
            lineHeight: 21,
        },
        kudosImage: {
            width: "100%",
            alignSelf: "flex-start",
            height: 200,
            maxHeight: Dimensions.get("window").height * 0.5,
            resizeMode: "contain",
            borderRadius: 8,
            marginBottom: 8,
        },
        timeText: {
            color: ThemedColor.caption,
            fontSize: 12,
            marginTop: 10,
        },
        unreadDot: {
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: ThemedColor.error,
        },
    });
