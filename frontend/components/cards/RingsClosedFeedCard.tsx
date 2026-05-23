import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import CachedImage from "../CachedImage";
import * as Haptics from "expo-haptics";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { Trophy } from "phosphor-react-native";
import CongratulateModal from "@/components/modals/CongratulateModal";

type RingsClosedFeedCardProps = {
    id: string;
    timestamp: string;
    content: string;
    user: {
        _id: string;
        handle: string;
        display_name: string;
        profile_picture: string;
    };
};

const RingsClosedFeedCard = React.memo(({
    id,
    timestamp,
    content,
    user,
}: RingsClosedFeedCardProps) => {
    const ThemedColor = useThemeColor();
    const { user: currentUser } = useAuth();
    const [showCongratulateModal, setShowCongratulateModal] = useState(false);

    // Calculate time ago
    const timeAgo = useMemo(() => {
        const now = new Date();
        const itemTime = new Date(timestamp);
        const diffMs = now.getTime() - itemTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return "now";
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}w`;
    }, [timestamp]);

    const handleUserPress = useCallback(async () => {
        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            // ignored
        }
        router.push(`/account/${user._id}`);
    }, [user._id]);

    const handleCongratulatePress = useCallback(async () => {
        if (!currentUser?._id) {
            return;
        }

        if (currentUser._id === user._id) {
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            // ignored
        }

        setShowCongratulateModal(true);
    }, [currentUser, user._id]);

    const isOwnItem = currentUser?._id === user._id;

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: ThemedColor.background,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        content: {
            paddingVertical: 12,
        },
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
            color: ThemedColor.text,
        },
        userHandle: {
            fontSize: 14,
            fontWeight: "300",
            color: ThemedColor.caption,
        },
        timeText: {
            fontSize: 12,
            fontWeight: "400",
            color: ThemedColor.caption,
        },
        categorySection: {
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: 18,
            gap: 12,
        },
        taskIndicator: {
            fontSize: 13,
            fontWeight: "300",
            letterSpacing: -0.13,
            color: ThemedColor.caption,
        },
        categoryRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        categoryInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            maxWidth: "60%",
            flex: 1,
        },
        categoryText: {
            fontSize: 16,
            fontWeight: "400",
            letterSpacing: -0.16,
            color: ThemedColor.text,
        },
        dot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: ThemedColor.primary,
        },
        congratulateButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        congratulateText: {
            fontSize: 14,
            fontWeight: "400",
            letterSpacing: -0.14,
            color: ThemedColor.primary,
        },
        contentSection: {
            paddingHorizontal: HORIZONTAL_PADDING,
        },
        taskContent: {
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 20,
            color: ThemedColor.text,
        },
    }), [ThemedColor]);

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* User Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.userInfo}
                        activeOpacity={0.4}
                        onPress={handleUserPress}>
                        <CachedImage
                            source={{ uri: user.profile_picture }}
                            style={styles.userIcon}
                            variant="thumbnail"
                            cachePolicy="memory-disk"
                        />
                        <View style={styles.userDetails}>
                            <ThemedText style={styles.userName}>
                                {user.display_name}
                            </ThemedText>
                            <ThemedText style={styles.userHandle}>
                                {user.handle}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                    <ThemedText style={styles.timeText}>
                        {timeAgo}
                    </ThemedText>
                </View>

                {/* Category Section with Congratulate Button */}
                <View style={styles.categorySection}>
                    <ThemedText style={styles.taskIndicator}>
                        closed all their rings
                    </ThemedText>
                    <View style={styles.categoryRow}>
                        <View style={styles.categoryInfo}>
                            <ThemedText style={styles.categoryText}>
                                Plan
                            </ThemedText>
                            <View style={styles.dot} />
                            <ThemedText style={styles.categoryText}>
                                Do
                            </ThemedText>
                            <View style={styles.dot} />
                            <ThemedText style={styles.categoryText}>
                                Share
                            </ThemedText>
                        </View>
                        {!isOwnItem && (
                            <TouchableOpacity
                                style={[
                                    styles.congratulateButton,
                                    !currentUser?._id && { opacity: 0.5 },
                                ]}
                                onPress={handleCongratulatePress}
                                disabled={!currentUser?._id}>
                                <Trophy size={20} color={ThemedColor.primary} weight="regular" />
                                <ThemedText style={styles.congratulateText}>
                                    {!currentUser?._id ? "Login" : "Congratulate"}
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Content */}
                <View style={styles.contentSection}>
                    <ThemedText style={styles.taskContent}>
                        {content}
                    </ThemedText>
                </View>

                {/* Congratulate Modal */}
                <CongratulateModal
                    visible={showCongratulateModal}
                    setVisible={setShowCongratulateModal}
                    task={{
                        id: id,
                        content: "Closed all rings",
                        value: 0,
                        priority: 0,
                        categoryId: "",
                    }}
                    congratulationConfig={{
                        userHandle: user.handle,
                        receiverId: user._id,
                        categoryName: "Rings",
                    }}
                />
            </View>
        </View>
    );
});

RingsClosedFeedCard.displayName = "RingsClosedFeedCard";

export default RingsClosedFeedCard;
