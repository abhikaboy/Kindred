import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import CachedImage from "../CachedImage";
import * as Haptics from "expo-haptics";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { Trophy } from "phosphor-react-native";
import Svg, { Circle } from "react-native-svg";
import CongratulateModal from "@/components/modals/CongratulateModal";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A small ring that animates from empty to full on mount ("rings closed"). */
const FillingRing = ({
    size = 36,
    stroke = 5,
    color,
    trackColor,
}: {
    size?: number;
    stroke?: number;
    color: string;
    trackColor: string;
}) => {
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
        }).start();
    }, [anim]);

    const strokeDashoffset = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0],
    });

    return (
        <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
            <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
            />
        </Svg>
    );
};

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

    // The feed header already shows the actor, so strip a leading display name
    // from the backend content; the headline reads "Closed all their rings
    // today!" instead of repeating the name.
    const message = useMemo(() => {
        let text = content ?? "";
        if (user.display_name && text.startsWith(`${user.display_name} `)) {
            text = text.slice(user.display_name.length + 1);
        }
        return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
    }, [content, user.display_name]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: ThemedColor.background,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        content: {
            paddingVertical: 20,
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
        ringRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: HORIZONTAL_PADDING,
        },
        headline: {
            flex: 1,
            color: ThemedColor.text,
        },
        congratulateButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        congratulateText: {
            fontSize: 14,
            letterSpacing: -0.14,
            color: ThemedColor.primary,
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

                {/* Ring + headline + Congratulate on one row (no card box) */}
                <View style={styles.ringRow}>
                    <FillingRing
                        size={36}
                        stroke={3}
                        color={ThemedColor.primary}
                        trackColor={ThemedColor.tertiary}
                    />
                    <ThemedText type="defaultSemiBold" style={styles.headline}>
                        {message}
                    </ThemedText>
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
