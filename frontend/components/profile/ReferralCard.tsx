import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { Gift, CaretRight } from "phosphor-react-native";
import { useReferral } from "@/hooks/useReferral";

export default function ReferralCard() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { totalReferrals, unlocksRemaining, isLoadingStats } = useReferral();

    const handlePress = () => {
        router.push("/(logged-in)/rewards");
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            style={[
                styles.container,
                {
                    backgroundColor: ThemedColor.lightened,
                    borderWidth: 0.5,
                    borderColor: ThemedColor.tertiary,
                },
            ]}>
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.primary + "20" }]}>
                        <Gift size={24} color={ThemedColor.primary} weight="fill" />
                    </View>
                    <View style={styles.textContainer}>
                        <ThemedText type="defaultSemiBold" style={styles.title}>
                            Invite Friends
                        </ThemedText>
                        <ThemedText type="lightBody" style={[styles.subtitle, { color: ThemedColor.caption }]}>
                            {isLoadingStats ? "..." : `${totalReferrals} referred • ${unlocksRemaining} unlocks`}
                        </ThemedText>
                    </View>
                </View>
                <CaretRight size={20} color={ThemedColor.caption} weight="bold" />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    leftSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 16,
    },
    subtitle: {
        fontSize: 13,
    },
});

