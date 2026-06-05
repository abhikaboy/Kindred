import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ListBullets, CalendarBlank } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface FloatingViewToggleProps {
    activeTab: string; // "List" | "Calendar"
    setActiveTab: (tab: string) => void;
}

/**
 * Condensed List/Calendar switcher that floats at the bottom-left, mirroring
 * FloatingDateNav on the right. Replaces the segmented control in the header so
 * the daily page reclaims that vertical space.
 */
export const FloatingViewToggle: React.FC<FloatingViewToggleProps> = ({ activeTab, setActiveTab }) => {
    const ThemedColor = useThemeColor();
    const isList = activeTab === "List";

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary },
            ]}>
            <TouchableOpacity
                style={[styles.button, isList && { backgroundColor: ThemedColor.primary }]}
                onPress={() => setActiveTab("List")}
                accessibilityRole="button"
                accessibilityLabel="List view"
                accessibilityState={{ selected: isList }}>
                <ListBullets size={20} color={isList ? "#FFFFFF" : ThemedColor.text} weight="bold" />
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.button, !isList && { backgroundColor: ThemedColor.primary }]}
                onPress={() => setActiveTab("Calendar")}
                accessibilityRole="button"
                accessibilityLabel="Calendar view"
                accessibilityState={{ selected: !isList }}>
                <CalendarBlank size={18} color={!isList ? "#FFFFFF" : ThemedColor.text} weight="bold" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        // Sits directly above FloatingDateNav (bottom: 100, height: 48) + gap.
        bottom: 156,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 4,
        gap: 4,
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
});
