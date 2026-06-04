import React from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { CheckCircle, Folder, Camera, Microphone } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface TaskSelectionViewProps {
    opacity: Animated.Value;
    onTaskPress: () => void;
    onPostPress: () => void;
    onWorkspacePress: () => void;
    onVoiceInputPress: () => void;
    onLayout: (event: any) => void;
}

export const TaskSelectionView: React.FC<TaskSelectionViewProps> = ({
    opacity,
    onTaskPress,
    onPostPress,
    onWorkspacePress,
    onVoiceInputPress,
    onLayout,
}) => {
    const ThemedColor = useThemeColor();

    return (
        <Animated.View
            style={[styles.menuSection, { opacity }]}
            onLayout={onLayout}
        >
            <TouchableOpacity style={styles.menuItem} onPress={onTaskPress}>
                <View style={styles.menuItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                        <CheckCircle size={24} color={ThemedColor.primary} weight="bold" />
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">Task</ThemedText>
                        <ThemedText type="caption">Create a new task</ThemedText>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={onPostPress}>
                <View style={styles.menuItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                        <Camera size={20} color={ThemedColor.primary} weight="bold" />
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">Post</ThemedText>
                        <ThemedText type="caption">Share a completed task</ThemedText>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={onWorkspacePress}>
                <View style={styles.menuItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                        <Folder size={20} color={ThemedColor.primary} weight="bold" />
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">Workspace</ThemedText>
                        <ThemedText type="caption">Create a new workspace</ThemedText>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={onVoiceInputPress}>
                <View style={styles.menuItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                        <Microphone size={22} color={ThemedColor.primary} weight="bold" />
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">Voice Input</ThemedText>
                        <ThemedText type="caption">Capture tasks with your voice</ThemedText>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    menuSection: {
        padding: 8,
    },
    menuItem: {
        borderBottomWidth: 0,
    },
    menuItemContent: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    menuItemText: {
        flex: 1,
        gap: 2,
    },
});
