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
        <View style={styles.container}>
            <View style={styles.gridContainer}>
                <View style={styles.buttonWrapper}>
                    <PrimaryButton
                        title="Edit Profile"
                        onPress={() => {
                            router.push("/(logged-in)/(tabs)/(profile)/edit");
                        }}
                        style={styles.button}
                    />
                </View>
                <TouchableOpacity
                    onPress={() => {
                        router.push("/(logged-in)/(tabs)/(profile)/friends");
                    }}
                    style={[
                        styles.friendsButton,
                        {
                            backgroundColor: ThemedColor.lightened,
                            borderColor: ThemedColor.tertiary,
                            boxShadow: ThemedColor.shadowSmall,
                        },
                    ]}>
                    <ThemedText type="lightBody" style={styles.friendsText}>
                        {friendsCount} Friends
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
    },
    gridContainer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    buttonWrapper: {
        width: "48%",
    },
    button: {
        width: "100%",
    },
    friendsButton: {
        width: "48%",
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.5,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    friendsText: {
        width: "100%",
        textAlign: "center",
        fontWeight: "500",
    },
});
