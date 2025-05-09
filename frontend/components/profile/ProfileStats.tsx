import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import FollowButton from "@/components/inputs/FollowButton";

interface ProfileStatsProps {
    friendsCount: number;
    tasksComplete: number;
}

export default function ProfileStats({ friendsCount, tasksComplete }: ProfileStatsProps) {
    return (
        <View style={styles.statsContainer}>
            <FollowButton following={false} />
            <ThemedText type="lightBody">{friendsCount} Friends</ThemedText>
            <ThemedText type="lightBody">{tasksComplete} Tasks Done</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    statsContainer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 0,
        paddingRight: 16,
        alignItems: "center",
        width: "100%",
    },
});
