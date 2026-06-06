import React from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import type { TaggedUser } from "./types";

// Tagged users display by name; fall back to their handle without the leading "@".
const taggedDisplayName = (u: TaggedUser) => u.name?.trim() || u.handle.replace(/^@/, "");

type StackedAvatarProps = {
    icon?: string;
    size: number;
    ringColor: string;
    placeholderColor: string;
    overlap: boolean;
    zIndex: number;
};

const StackedAvatar = ({ icon, size, ringColor, placeholderColor, overlap, zIndex }: StackedAvatarProps) => {
    const base = {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: ringColor,
        marginLeft: overlap ? -size / 1.8 : 0,
        zIndex,
    };
    return icon ? (
        <CachedImage source={{ uri: icon }} style={base} variant="thumbnail" cachePolicy="memory-disk" />
    ) : (
        <View style={[base, { backgroundColor: placeholderColor }]} />
    );
};

export type PostCardHeaderProps = {
    icon?: string;
    name: string;
    username?: string;
    userId?: string;
    taggedUsers?: TaggedUser[];
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
    taggedUsers = [],
    timeLabel,
    onOptionsPress,
    disableNavigation = false,
}: PostCardHeaderProps) => {
    const ThemedColor = useThemeColor();

    const navigateToUser = async (id?: string) => {
        if (disableNavigation || !id) return;
        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch {}
        router.push(`/account/${id}`);
    };

    return (
        <View style={styles.header}>
            <View style={styles.userInfo}>
                <TouchableOpacity
                    activeOpacity={disableNavigation ? 1 : 0.4}
                    onPress={() => navigateToUser(userId)}
                    disabled={disableNavigation}
                    style={styles.avatarStack}
                >
                    <StackedAvatar
                        icon={icon}
                        size={48}
                        ringColor={ThemedColor.background}
                        placeholderColor={ThemedColor.lightened}
                        overlap={false}
                        zIndex={taggedUsers.length + 1}
                    />
                    {taggedUsers.slice(0, 3).map((u, i) => (
                        <StackedAvatar
                            key={u.id}
                            icon={u.icon}
                            size={36}
                            ringColor={ThemedColor.background}
                            placeholderColor={ThemedColor.lightened}
                            overlap
                            zIndex={taggedUsers.length - i}
                        />
                    ))}
                </TouchableOpacity>
                <View style={styles.userDetails}>
                    <TouchableOpacity
                        activeOpacity={disableNavigation ? 1 : 0.4}
                        onPress={() => navigateToUser(userId)}
                        disabled={disableNavigation}
                    >
                        <ThemedText type="default" style={[styles.userName, { color: ThemedColor.text }]}>
                            {name}
                        </ThemedText>
                    </TouchableOpacity>
                    {username || taggedUsers.length > 0 ? (
                        <View style={styles.handleRow}>
                            {username ? (
                                <TouchableOpacity
                                    activeOpacity={disableNavigation ? 1 : 0.4}
                                    onPress={() => navigateToUser(userId)}
                                    disabled={disableNavigation}
                                >
                                    <ThemedText type="caption" style={[styles.usernameText, { color: ThemedColor.caption }]}>
                                        {username}
                                    </ThemedText>
                                </TouchableOpacity>
                            ) : null}
                            {taggedUsers.length > 0 ? (
                                <>
                                    <ThemedText type="caption" style={[styles.usernameText, { color: ThemedColor.caption }]}>
                                        {" "}with{" "}
                                    </ThemedText>
                                    {taggedUsers.map((u, i) => (
                                        <View key={u.id} style={styles.taggedNameWrap}>
                                            <TouchableOpacity
                                                activeOpacity={disableNavigation ? 1 : 0.4}
                                                onPress={() => navigateToUser(u.id)}
                                                disabled={disableNavigation}
                                            >
                                                <ThemedText
                                                    type="caption"
                                                    numberOfLines={1}
                                                    style={[styles.usernameText, styles.taggedName, { color: ThemedColor.primary }]}
                                                >
                                                    {"@" + taggedDisplayName(u)}
                                                </ThemedText>
                                            </TouchableOpacity>
                                            {i < taggedUsers.length - 1 ? (
                                                <ThemedText type="caption" style={[styles.usernameText, { color: ThemedColor.caption }]}>
                                                    {", "}
                                                </ThemedText>
                                            ) : null}
                                        </View>
                                    ))}
                                </>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            </View>
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
    avatarStack: {
        flexDirection: "row",
        alignItems: "center",
    },
    userDetails: {
        flex: 1,
        gap: 3,
    },
    handleRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
    },
    taggedNameWrap: {
        flexDirection: "row",
        alignItems: "center",
    },
    taggedName: {
        maxWidth: 120,
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
