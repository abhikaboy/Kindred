import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { GearSix } from "phosphor-react-native";

interface WelcomeHeaderProps {
    userName?: string;
    ThemedColor: any;
    onSettingsPress: () => void;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ userName, ThemedColor, onSettingsPress }) => {
    const currentHour = new Date().getHours();

    let greeting;
    if (currentHour < 12) {
        greeting = "It's Coffee Time,";
    } else if (currentHour < 18) {
        greeting = "Keep that energy going,";
    } else {
        greeting = "Time to unwind,";
    }

    return (
        <View style={styles.headerContainer}>
            <View style={styles.topRow}>
                <View style={styles.headerRow}>
                    <ThemedText type="subheading" style={[styles.title, { color: ThemedColor.text }]}>
                        {greeting}
                    </ThemedText>
                    <ThemedText type="title" style={[styles.title, { color: ThemedColor.text, fontSize: 24, letterSpacing: -1 }]}>
                        {userName ? `${userName}!` : "there!"}{" "}
                        {currentHour < 12 ? "☕" : currentHour < 18 ? "🌤️" : "🌙"}
                    </ThemedText>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity onPress={onSettingsPress} hitSlop={8} activeOpacity={0.7} style={styles.gearBtn}>
                        <GearSix size={22} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 16,
        paddingTop: 20,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    headerRow: {
        flex: 1,
        flexDirection: "column",
        alignItems: "flex-start",
        flexWrap: "wrap",
    },
    title: {
        fontWeight: "600",
        fontSize: 20,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 2,
    },
    gearBtn: {
        padding: 4,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
});
