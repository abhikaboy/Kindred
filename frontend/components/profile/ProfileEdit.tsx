import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import { router } from "expo-router";

interface ProfileStatsProps {
    friendsCount: number;
}

export default function ProfileStats({ friendsCount }: ProfileStatsProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.statsContainer}>
            <View style={{ width: "50%" }}>
                <PrimaryButton
                    title="Edit Profile"
                    onPress={() => {
                        router.push("/(logged-in)/(tabs)/(profile)/edit");
                    }}
                />
            </View>
            <TouchableOpacity
                onPress={() => {
                    router.push("/(logged-in)/(tabs)/(profile)/friends");
                }}
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
            </TouchableOpacity>
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
