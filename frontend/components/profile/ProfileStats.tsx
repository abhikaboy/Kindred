import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import FollowButton from "@/components/inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Profile, RelationshipStatus } from "@/api/types";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface ProfileStatsProps {
    friendsCount: number;
    profileUserId?: string;
    profile?: Profile;
    onRelationshipChange?: (newStatus: RelationshipStatus) => void;
}

export default function ProfileStats({
    friendsCount,
    profileUserId,
    profile,
    onRelationshipChange,
}: ProfileStatsProps) {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    const status = profile?.relationship?.status;
    const canViewFriends = status === "connected" || status === "self";

    const handleFriendsPress = async () => {
        if (!profileUserId || !canViewFriends) return;
        if (Platform.OS === "ios") {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
        }
        router.push(`/friends/${profileUserId}`);
    };

    return (
        <View style={styles.statsContainer}>
            <View
                style={{
                    width: "48%",
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                {profile && <FollowButton profile={profile} onRelationshipChange={onRelationshipChange} />}
            </View>
            <TouchableOpacity
                onPress={handleFriendsPress}
                activeOpacity={canViewFriends ? 0.6 : 1}
                disabled={!canViewFriends}
                style={{
                    width: "48%",
                    backgroundColor: canViewFriends ? ThemedColor.lightenedCard : "transparent",
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                    paddingVertical: 8,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <ThemedText type="lightBody" style={{ width: "100%", textAlign: "center" }}>
                    {friendsCount} Friends
                </ThemedText>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    statsContainer: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: 12,
    },
});
