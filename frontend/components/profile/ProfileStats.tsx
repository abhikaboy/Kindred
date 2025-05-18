import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import FollowButton from "@/components/inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";

interface ProfileStatsProps {
    friendsCount: number;
}

export default function ProfileStats({ friendsCount }: ProfileStatsProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.statsContainer}>
            <View style={{ width: "50%" }}>
                <FollowButton following={false} />
            </View>
            <View
                style={{
                    width: "50%",
                    backgroundColor: ThemedColor.lightened,
                    borderRadius: 30,
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
    },
});
