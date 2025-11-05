import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ListIcon } from "phosphor-react-native";
import { AttachStep } from "react-native-spotlight-tour";

interface WelcomeHeaderProps {
    userName?: string;
    onMenuPress: () => void;
    ThemedColor: any;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ userName, onMenuPress, ThemedColor }) => {
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
        <>
            <AttachStep index={2}>
                <TouchableOpacity onPress={onMenuPress}>
                    <ListIcon size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
            </AttachStep>

            <View style={styles.headerContainer}>
                <View style={styles.headerRow}>
                    <ThemedText type="subheading" style={[styles.title, { color: ThemedColor.text }]}>
                        {greeting}
                    </ThemedText>
                    <ThemedText type="title" style={[styles.title, { color: ThemedColor.text }]}>
                        {userName ? `${userName}!` : "there!"}{" "}
                        {currentHour < 12 ? "☕" : currentHour < 18 ? "🌤️" : "🌙"}
                    </ThemedText>
                </View>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 16,
        paddingTop: 20,
    },
    headerRow: {
        flexDirection: "column",
        alignItems: "flex-start",
        flexWrap: "wrap",
    },
    title: {
        fontWeight: "600",
    },
});
