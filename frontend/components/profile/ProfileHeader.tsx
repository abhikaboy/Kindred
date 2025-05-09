import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface ProfileHeaderProps {
    displayName: string;
    handle: string;
    nameHeight: number;
}

export default function ProfileHeader({ displayName, handle, nameHeight }: ProfileHeaderProps) {
    const ThemedColor = useThemeColor();

    return (
        <View style={[styles.nameContainer, { top: Dimensions.get("window").height * 0.4 - nameHeight }]}>
            <ThemedText type="hero" style={styles.displayName}>
                {displayName}
            </ThemedText>
            <ThemedText style={[styles.handle, { color: ThemedColor.caption }]}>{handle}</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    nameContainer: {
        flexDirection: "row",
        flex: 1,
        alignItems: "flex-end",
        paddingHorizontal: 20,
        gap: 8,
    },
    displayName: {
        fontWeight: "700",
        zIndex: 3,
        verticalAlign: "top",
    },
    handle: {
        zIndex: 3,
        bottom: 8,
    },
});
