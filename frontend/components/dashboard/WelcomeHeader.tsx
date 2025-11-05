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
        greeting = "Good morning,";
    } else if (currentHour < 18) {
        greeting = "Good afternoon,";
    } else {
        greeting = "Good evening,";
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
                    <ThemedText type="title" style={[styles.title, { color: ThemedColor.text }]}>
                        {greeting} {userName ? `${userName}!` : "there!"}{" "}
                        {currentHour < 12 ? "☀️" : currentHour < 18 ? "🌤️" : "🌙"}
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
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
    },
    title: {
        fontWeight: "600",
    },
});
