import React from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

interface DailyHeaderProps {
    onOpenDrawer: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedDate: Date;
}

export const DailyHeader: React.FC<DailyHeaderProps> = ({ onOpenDrawer, activeTab, setActiveTab, selectedDate }) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={onOpenDrawer}>
                <Feather name="menu" size={24} color={ThemedColor.caption} />
            </TouchableOpacity>
            <View style={styles.headerContainer}>
                <ThemedText type="title" style={styles.title}>
                    {selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                    })}
                </ThemedText>
                <View style={styles.toggleContainer}>
                    <SegmentedControl
                        options={["List", "Calendar"]}
                        selectedOption={activeTab}
                        onOptionPress={setActiveTab}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    headerContainer: {
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
    toggleContainer: {
        width: "100%",
        paddingTop: 12,
    },
});
