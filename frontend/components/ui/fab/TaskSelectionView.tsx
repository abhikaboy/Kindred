import React from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { CheckCircle, Folder, Camera } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface TaskSelectionViewProps {
    opacity: Animated.Value;
    onTaskPress: () => void;
    onSecondaryPress: () => void;
    isOnFeedTab: boolean;
    onLayout: (event: any) => void;
}

export const TaskSelectionView: React.FC<TaskSelectionViewProps> = ({
    opacity,
    onTaskPress,
    onSecondaryPress,
    isOnFeedTab,
    onLayout,
}) => {
    const ThemedColor = useThemeColor();

    return (
        <Animated.View
            style={[
                styles.menuSection,
                {
                    opacity,
                }
            ]}
            onLayout={onLayout}
        >
            <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: ThemedColor.lightened }]}
                onPress={onTaskPress}
            >
                <View style={styles.menuItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: ThemedColor.lightened }]}>
                        <CheckCircle size={24} color={ThemedColor.primary} weight="bold" />
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">Task</ThemedText>
                        <ThemedText type="caption">
                            Create a new task
                        </ThemedText>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.menuItem}
                onPress={onSecondaryPress}
            >
                <View style={styles.menuItemContent}>
                    <View
                        style={[
                            styles.iconContainer,
                            { backgroundColor: ThemedColor.lightened },
                        ]}
                    >
                        {isOnFeedTab ? (
                            <Camera size={20} color={ThemedColor.primary} weight="bold" />
                        ) : (
                            <Folder size={20} color={ThemedColor.primary} weight="bold" />
                        )}
                    </View>
                    <View style={styles.menuItemText}>
                        <ThemedText type="defaultSemiBold">
                            {isOnFeedTab ? "Post" : "Workspace"}
                        </ThemedText>
                        <ThemedText type="caption">
                            {isOnFeedTab ? "Share a completed task" : "Create a new workspace"}
                        </ThemedText>
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
