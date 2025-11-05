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
    return (
        <>
            <AttachStep index={2}>
                <TouchableOpacity onPress={onMenuPress}>
                    <ListIcon size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
            </AttachStep>

            <View style={styles.headerContainer}>
                <View style={styles.headerRow}>
                    <ThemedText type="title" style={styles.title}>
                        Welcome {userName}! ☀️
                    </ThemedText>
                </View>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontWeight: "600",
    },
});
