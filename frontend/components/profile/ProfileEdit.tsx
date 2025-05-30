import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";

interface ProfileStatsProps {
    friendsCount: number;
}

export default function ProfileStats({ friendsCount }: ProfileStatsProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.statsContainer}>
            <View style={{ width: "50%" }}>
                <PrimaryButton title="Edit Profile" onPress={() => {}} />
            </View>
            <View
                style={{
                    width: "50%",
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
        gap: 4,
    },
});
