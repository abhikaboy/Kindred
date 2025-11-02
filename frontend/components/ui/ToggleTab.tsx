import { useThemeColor } from "@/hooks/useThemeColor";
import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet, LayoutChangeEvent } from "react-native";

interface TaskTabsProps {
    tabs: string[];
    activeTab: number;
    setActiveTab: (index: number) => void;
}
const ThemedColor = useThemeColor();

const TaskTabs: React.FC<TaskTabsProps> = ({ tabs, activeTab, setActiveTab }) => {
    const underlineAnim = useRef(new Animated.Value(0)).current;
    const tabWidth = useRef(0);
    useEffect(() => {
        Animated.spring(underlineAnim, {
            toValue: activeTab * (tabWidth.current || 0),
            useNativeDriver: true,
            speed: 5,
            bounciness: 8,
        }).start();
    }, [activeTab]);

    const onLayout = (e: LayoutChangeEvent) => {
        const totalWidth = e.nativeEvent.layout.width;
        tabWidth.current = totalWidth / tabs.length;
    };

    return (
        <View style={styles.container} onLayout={onLayout}>
            {tabs.map((tab, index) => (
                <TouchableOpacity
                    key={tab}
                    style={[styles.tab, { flex: 1 }]}
                    onPress={() => setActiveTab(index)}
                    activeOpacity={0.8}>
                    <Text style={[styles.text, index === activeTab && styles.activeText]}>{tab}</Text>
                </TouchableOpacity>
            ))}
            <Animated.View
                style={[
                    styles.underline,
                    {
                        transform: [{ translateX: underlineAnim }],
                        width: `${100 / tabs.length}%`,
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        position: "relative",
    },
    tab: {
        alignItems: "center",
        paddingVertical: 12,
    },
    text: {
        fontSize: 16,
        color: "#999",
        fontWeight: "500",
    },
    activeText: {
        color: "#fff",
    },
    underline: {
        position: "absolute",
        bottom: 0,
        height: 3,
        backgroundColor: ThemedColor.primary,
        borderRadius: 2,
    },
});

export default TaskTabs;
