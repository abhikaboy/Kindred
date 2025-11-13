import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    tabs: string[];
    activeTab: number;
    setActiveTab: (index: number) => void;
};

export default function TaskTabs({ tabs, activeTab, setActiveTab }: Props) {
    const ThemedColor = useThemeColor(); // Move this INSIDE the component
    const styles = createStyles(ThemedColor); // Create styles with theme colors

    return (
        <View style={styles.container}>
            {tabs.map((tab, index) => (
                <TouchableOpacity
                    key={`tab-${index}-${tab}`} // Better key that includes tab name
                    style={[styles.tab, activeTab === index && styles.activeTab]}
                    onPress={() => setActiveTab(index)}
                    activeOpacity={0.7}>
                    <ThemedText
                        style={[styles.tabText, activeTab === index ? styles.activeTabText : styles.inactiveTabText]}>
                        {tab}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        tab: {
            flex: 1,
            paddingBottom: 12,
            paddingTop: 4,
            position: "relative",
        },
        activeTab: {
            borderBottomWidth: 2,
            borderBottomColor: ThemedColor.primary,
            marginBottom: -1, // Overlap the container border
        },
        activeTabText: {
            fontWeight: "600",
            color: ThemedColor.text,
        },
        inactiveTabText: {
            fontWeight: "500",
            color: ThemedColor.caption,
        },
        tabText: {
            fontSize: 16,
            fontFamily: "Outfit",
            textAlign: "center",
        },
    });
