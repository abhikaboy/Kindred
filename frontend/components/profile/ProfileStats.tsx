import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import FollowButton from "@/components/inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Profile, RelationshipStatus } from "@/api/types";

interface ProfileStatsProps {
    friendsCount: number;
    profileUserId?: string; // ID of the profile being viewed
    profile?: Profile; // Profile with relationship information
    onRelationshipChange?: (newStatus: RelationshipStatus) => void; // Callback for relationship changes
}

export default function ProfileStats({
    friendsCount,
    profileUserId,
    profile,
    onRelationshipChange,
}: ProfileStatsProps) {
    const ThemedColor = useThemeColor();

    return (
        <View style={styles.statsContainer}>
            <View style={{ width: "49%" }}>
                {profile && <FollowButton profile={profile} onRelationshipChange={onRelationshipChange} />}
            </View>
            <View
                style={{
                    width: "49%",
                    backgroundColor: ThemedColor.lightened,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <ThemedText type="lightBody" style={{ width: "100%", textAlign: "center" }}>
                    {friendsCount} Friends
                </ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    statsContainer: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: 8,
    },
});
