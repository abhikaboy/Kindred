import React, { useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import UserInfoRowTimed from "../UserInfo/UserInfoRowTimed";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import EncourageModal from "../modals/EncourageModal";

type TaskFeedCardProps = {
    taskId: string;
    content: string;
    workspaceName: string;
    categoryName: string;
    timestamp: string;
    priority: number;
    value: number;
    user: {
        _id: string;
        handle: string;
        display_name: string;
        profile_picture: string;
    };
};

const TaskFeedCard = React.memo(({
    taskId,
    content,
    workspaceName,
    categoryName,
    timestamp,
    priority,
    value,
    user,
}: TaskFeedCardProps) => {
    const ThemedColor = useThemeColor();
    const { userId: currentUserId } = useAuth();
    const [showEncourageModal, setShowEncourageModal] = useState(false);

    // Calculate time ago
    const calculateTimeAgo = useCallback((timestamp: string) => {
        const now = new Date();
        const taskTime = new Date(timestamp);
        const diffMs = now.getTime() - taskTime.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHours < 1) return 0;
        return diffHours;
    }, []);

    const timeAgo = calculateTimeAgo(timestamp);

    const handleEncourage = useCallback(() => {
        setShowEncourageModal(true);
    }, []);

    const isOwnTask = currentUserId === user._id;

    const styles = StyleSheet.create({
        container: {
            backgroundColor: ThemedColor.card,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 12,
            padding: 16,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        taskContext: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            marginBottom: 8,
        },
        taskContextText: {
            fontSize: 13,
            color: ThemedColor.caption,
            marginLeft: 6,
        },
        taskContent: {
            fontSize: 16,
            lineHeight: 22,
            color: ThemedColor.text,
            marginBottom: 16,
        },
        actionBar: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: ThemedColor.border,
        },
        encourageButton: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: ThemedColor.primary,
        },
        encourageButtonText: {
            color: "#ffffff",
            fontSize: 14,
            fontWeight: "600",
            marginLeft: 6,
        },
    });

    return (
        <View style={styles.container}>
            {/* User Info Header */}
            <UserInfoRowTimed
                icon={user.profile_picture}
                name={user.display_name}
                username={user.handle}
                time={timeAgo}
                userId={user._id}
            />

            {/* Task Context */}
            <View style={styles.taskContext}>
                <Ionicons name="checkmark-circle" size={16} color={ThemedColor.primary} />
                <ThemedText style={styles.taskContextText}>
                    Created task in {workspaceName} → {categoryName}
                </ThemedText>
            </View>

            {/* Task Content */}
            <ThemedText style={styles.taskContent}>
                {content}
            </ThemedText>

            {/* Action Bar */}
            <View style={styles.actionBar}>
                <View style={{ flex: 1 }} />
                {!isOwnTask && (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleEncourage}
                        style={styles.encourageButton}
                    >
                        <Ionicons name="heart" size={16} color="#ffffff" />
                        <ThemedText style={styles.encourageButtonText}>
                            Encourage
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {/* Encourage Modal */}
            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={{
                    id: taskId,
                    content: content,
                    value: value,
                    priority: priority,
                    categoryId: "", // Not needed for encouragement
                }}
                encouragementConfig={{
                    userHandle: user.handle,
                    receiverId: user._id,
                    categoryName: categoryName,
                }}
            />
        </View>
    );
});

TaskFeedCard.displayName = "TaskFeedCard";

export default TaskFeedCard;

