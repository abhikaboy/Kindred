import React from "react";
import { View, StyleSheet, Dimensions, Image, TouchableOpacity } from "react-native";
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
}

export default function KudosItem({ kudos, formatTime }: KudosItemProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const router = useRouter();

    const isImage = kudos.type === "image";
    const isProfileLevel = kudos.scope === "profile"

    const handleAvatarPress = () => {
        router.push(`/account/${kudos.sender.id}` as any);
    };

    return (
        <View style={styles.kudosItem}>
            {/* User Avatar and Info */}
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
        </View>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        kudosItem: {
            flexDirection: "row",
        },
        userSection: {
            gap: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        userAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: ThemedColor.tertiary,
        },
        userInfo: {
            width: Dimensions.get("window").width * 0.2,
        },
        userName: {
            color: ThemedColor.text,
            fontSize: 14,
            width: Dimensions.get("window").width * 0.2,
        },
        kudosCard: {
            flex: 1,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 12,
            borderTopLeftRadius: 0,
            padding: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        taskInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
        },
        categoryText: {
            color: ThemedColor.primary,
            fontSize: 16,
            flexShrink: 1,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: ThemedColor.caption,
            flexShrink: 0,
        },
        taskName: {
            color: ThemedColor.text,
            fontSize: 16,
            flexShrink: 1,
        },
        contentContainer: {
            marginTop: 4,
            width: "100%",
        },
        messageText: {
            color: ThemedColor.text,
            fontSize: 16,
            lineHeight: 20,
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
            fontSize: 14,
            marginTop: 12,
        },
        unreadDot: {
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: 12,
            backgroundColor: ThemedColor.error,
        },
    });

