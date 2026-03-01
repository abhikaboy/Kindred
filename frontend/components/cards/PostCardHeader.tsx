import React from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

export type PostCardHeaderProps = {
    icon?: string;
    name: string;
    username?: string;
    userId?: string;
    timeLabel: string;
    onOptionsPress?: () => void;
    /** If true, the user info row is not pressable (e.g. in preview mode) */
    disableNavigation?: boolean;
};

const PostCardHeader = ({
    icon,
    name,
    username,
    userId,
    timeLabel,
    onOptionsPress,
    disableNavigation = false,
}: PostCardHeaderProps) => {
    const ThemedColor = useThemeColor();

    const handleUserPress = async () => {
        if (disableNavigation || !userId) return;
        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch {}
        router.push(`/account/${userId}`);
    };

    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.userInfo}
                activeOpacity={disableNavigation ? 1 : 0.4}
                onPress={handleUserPress}
                disabled={disableNavigation}
            >
                {icon ? (
                    <CachedImage
                        source={{ uri: icon }}
                        style={styles.userIcon}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={[styles.userIcon, { backgroundColor: ThemedColor.lightened, borderRadius: 24 }]} />
                )}
                <View style={styles.userDetails}>
                    <ThemedText type="default" style={[styles.userName, { color: ThemedColor.text }]}>
                        {name}
                    </ThemedText>
                    {username ? (
                        <ThemedText type="caption" style={[styles.usernameText, { color: ThemedColor.caption }]}>
                            {username}
                        </ThemedText>
                    ) : null}
                </View>
            </TouchableOpacity>
            <View style={styles.timeAndMenu}>
                {onOptionsPress ? (
                    <TouchableOpacity
                        onPress={onOptionsPress}
                        style={styles.menuButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color={ThemedColor.caption} />
                    </TouchableOpacity>
                ) : null}
                <ThemedText type="caption" style={[styles.timeText, { color: ThemedColor.caption }]}>
                    {timeLabel}
                </ThemedText>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        marginBottom: 18,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    userIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    userDetails: {
        flex: 1,
        gap: 3,
    },
    userName: {
        fontSize: 16,
        fontWeight: "400",
    },
    usernameText: {
        fontSize: 14,
        fontWeight: "300",
    },
    timeAndMenu: {
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
    },
    timeText: {
        fontSize: 12,
        fontWeight: "400",
    },
    menuButton: {
        padding: 2,
    },
});

export default PostCardHeader;
