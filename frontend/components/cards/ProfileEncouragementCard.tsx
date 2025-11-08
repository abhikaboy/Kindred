import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import CachedImage from "../CachedImage";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import EncourageModal from "../modals/EncourageModal";

// SparkleIcon component for encourage button
const SparkleIcon = ({ size = 24, color = "#ffffff" }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18.5232 12.0994L13.6847 10.3181L11.9035 5.47594C11.798 5.18937 11.6072 4.94206 11.3567 4.76736C11.1063 4.59267 10.8082 4.499 10.5029 4.499C10.1975 4.499 9.89949 4.59267 9.64904 4.76736C9.39858 4.94206 9.20773 5.18937 9.10225 5.47594L7.31912 10.3125L2.47694 12.0938C2.19037 12.1992 1.94305 12.3901 1.76836 12.6405C1.59367 12.891 1.5 13.189 1.5 13.4944C1.5 13.7997 1.59367 14.0978 1.76836 14.3482C1.94305 14.5987 2.19037 14.7895 2.47694 14.895L7.31256 16.6875L9.09381 21.5269C9.1993 21.8134 9.39014 22.0608 9.6406 22.2355C9.89106 22.4101 10.1891 22.5038 10.4944 22.5038C10.7998 22.5038 11.0978 22.4101 11.3483 22.2355C11.5987 22.0608 11.7896 21.8134 11.8951 21.5269L13.6763 16.6884L18.5185 14.9072C18.8051 14.8017 19.0524 14.6109 19.2271 14.3604C19.4018 14.1099 19.4954 13.8119 19.4954 13.5066C19.4954 13.2012 19.4018 12.9032 19.2271 12.6527C19.0524 12.4023 18.8051 12.2114 18.5185 12.1059L18.5232 12.0994ZM13.1616 15.2812C12.9589 15.3556 12.7749 15.4732 12.6222 15.6259C12.4696 15.7786 12.352 15.9626 12.2776 16.1653L10.4963 20.9897L8.71881 16.1616C8.64436 15.96 8.52712 15.7769 8.37516 15.6249C8.22319 15.4729 8.04011 15.3557 7.8385 15.2812L3.01412 13.5L7.8385 11.7188C8.04011 11.6443 8.22319 11.5271 8.37516 11.3751C8.52712 11.2231 8.64436 11.04 8.71881 10.8384L10.5001 6.01406L12.2813 10.8384C12.3557 11.0411 12.4733 11.2252 12.626 11.3778C12.7786 11.5305 12.9627 11.6481 13.1654 11.7225L17.9897 13.5037L13.1616 15.2812ZM13.5001 3.75C13.5001 3.55109 13.5791 3.36032 13.7197 3.21967C13.8604 3.07902 14.0511 3 14.2501 3H15.7501V1.5C15.7501 1.30109 15.8291 1.11032 15.9697 0.96967C16.1104 0.829018 16.3011 0.75 16.5001 0.75C16.699 0.75 16.8897 0.829018 17.0304 0.96967C17.171 1.11032 17.2501 1.30109 17.2501 1.5V3H18.7501C18.949 3 19.1397 3.07902 19.2804 3.21967C19.421 3.36032 19.5001 3.55109 19.5001 3.75C19.5001 3.94891 19.421 4.13968 19.2804 4.28033C19.1397 4.42098 18.949 4.5 18.7501 4.5H17.2501V6C17.2501 6.19891 17.171 6.38968 17.0304 6.53033C16.8897 6.67098 16.699 6.75 16.5001 6.75C16.3011 6.75 16.1104 6.67098 15.9697 6.53033C15.8291 6.38968 15.7501 6.19891 15.7501 6V4.5H14.2501C14.0511 4.5 13.8604 4.42098 13.7197 4.28033C13.5791 4.13968 13.5001 3.94891 13.5001 3.75ZM23.2501 8.25C23.2501 8.44891 23.171 8.63968 23.0304 8.78033C22.8897 8.92098 22.699 9 22.5001 9H21.7501V9.75C21.7501 9.94891 21.671 10.1397 21.5304 10.2803C21.3897 10.421 21.199 10.5 21.0001 10.5C20.8011 10.5 20.6104 10.421 20.4697 10.2803C20.3291 10.1397 20.2501 9.94891 20.2501 9.75V9H19.5001C19.3011 9 19.1104 8.92098 18.9697 8.78033C18.8291 8.63968 18.7501 8.44891 18.7501 8.25C18.7501 8.05109 18.8291 7.86032 18.9697 7.71967C19.1104 7.57902 19.3011 7.5 19.5001 7.5H20.2501V6.75C20.2501 6.55109 20.3291 6.36032 20.4697 6.21967C20.6104 6.07902 20.8011 6 21.0001 6C21.199 6 21.3897 6.07902 21.5304 6.21967C21.671 6.36032 21.7501 6.55109 21.7501 6.75V7.5H22.5001C22.699 7.5 22.8897 7.57902 23.0304 7.71967C23.171 7.86032 23.2501 8.05109 23.2501 8.25Z"
            fill={color}
        />
    </Svg>
);

type ProfileEncouragementCardProps = {
    user: {
        _id: string;
        handle: string;
        display_name: string;
        profile_picture: string;
    };
    tasksComplete: number;
    streak: number;
    points: number;
};

const ProfileEncouragementCard = React.memo(({
    user,
    tasksComplete,
    streak,
    points,
}: ProfileEncouragementCardProps) => {
    const ThemedColor = useThemeColor();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    const [showEncourageModal, setShowEncourageModal] = useState(false);

    const handleProfilePress = useCallback(() => {
        // @ts-ignore - Dynamic route navigation
        router.push(`/(logged-in)/profile/${user.handle}`);
    }, [user.handle, router]);

    const handleEncouragePress = useCallback(async () => {
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
            // Ignore haptics errors
        }

        setShowEncourageModal(true);
    }, [currentUser, user._id]);

    const isOwnProfile = currentUser?._id === user._id;

    // Format stats for display
    const statsDisplay = useMemo(() => {
        const stats = [];
        if (tasksComplete > 0) {
            stats.push(`${Math.floor(tasksComplete)} tasks`);
        }
        if (streak > 0) {
            stats.push(`${streak} day streak`);
        }
        if (points > 0) {
            stats.push(`${points} pts`);
        }
        return stats.join(" • ");
    }, [tasksComplete, streak, points]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: ThemedColor.background,
            paddingVertical: 20,
            paddingHorizontal: HORIZONTAL_PADDING,
            borderBottomWidth: 1.5,
            borderBottomColor: ThemedColor.tertiary,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
        },
        userInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
        },
        profilePicture: {
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: ThemedColor.primary,
        },
        userDetails: {
            flex: 1,
            gap: 4,
        },
        displayName: {
            fontSize: 17,
            fontWeight: "600",
            color: ThemedColor.text,
        },
        handle: {
            fontSize: 14,
            fontWeight: "300",
            color: ThemedColor.caption,
        },
        encourageButton: {
            backgroundColor: ThemedColor.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        encourageButtonDisabled: {
            opacity: 0.5,
        },
        encourageButtonText: {
            fontSize: 14,
            fontWeight: "600",
            color: "#FFFFFF",
        },
        statsSection: {
            flexDirection: "row",
            alignItems: "center",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: ThemedColor.tertiary,
        },
        statsText: {
            fontSize: 14,
            fontWeight: "400",
            color: ThemedColor.caption,
        },
        suggestionText: {
            fontSize: 13,
            fontWeight: "300",
            color: ThemedColor.caption,
            marginBottom: 8,
            fontStyle: "italic",
        },
    }), [ThemedColor]);

    return (
        <View style={styles.container}>
            {/* Suggestion Text */}
            <ThemedText style={styles.suggestionText}>
                Someone you might want to encourage
            </ThemedText>

            {/* User Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.userInfo}
                    onPress={handleProfilePress}
                    activeOpacity={0.7}>
                    <CachedImage
                        source={{ uri: user.profile_picture }}
                        style={styles.profilePicture}
                    />
                    <View style={styles.userDetails}>
                        <ThemedText style={styles.displayName}>
                            {user.display_name}
                        </ThemedText>
                        <ThemedText style={styles.handle}>
                            @{user.handle}
                        </ThemedText>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.encourageButton,
                        (!currentUser?._id || isOwnProfile) && styles.encourageButtonDisabled,
                    ]}
                    onPress={handleEncouragePress}
                    disabled={!currentUser?._id || isOwnProfile}
                    activeOpacity={0.8}>
                    <SparkleIcon size={16} color="#FFFFFF" />
                    <ThemedText style={styles.encourageButtonText}>
                        {!currentUser?._id
                            ? "Login"
                            : isOwnProfile
                              ? "You"
                              : "Encourage"}
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {/* Stats Section */}
            {statsDisplay && (
                <View style={styles.statsSection}>
                    <ThemedText style={styles.statsText}>
                        {statsDisplay}
                    </ThemedText>
                </View>
            )}

            {/* Profile Encouragement Modal */}
            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                isProfileLevel={true}
                encouragementConfig={{
                    userHandle: user.handle,
                    receiverId: user._id,
                    categoryName: "Profile", // Generic category for profile-level encouragements
                }}
            />
        </View>
    );
});

ProfileEncouragementCard.displayName = "ProfileEncouragementCard";

export default ProfileEncouragementCard;