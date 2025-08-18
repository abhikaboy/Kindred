import React, { useState, useMemo } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createEncouragementAPI } from "@/api/encouragement";
import { useAuth } from "@/hooks/useAuth";

interface EncourageModalProps {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    task?: {
        id: string;
        content: string;
        value: number;
        priority: number;
        categoryId: string;
    };
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string; // ID of the user receiving the encouragement
        categoryName: string; // Name of the category the task belongs to
    };
}

export default function EncourageModal({ visible, setVisible, task, encouragementConfig }: EncourageModalProps) {
    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const [encouragementMessage, setEncouragementMessage] = useState("");

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Get encouragements left from user data
    const encouragementsLeft = user?.encouragements || 0;

    const handleSendEncouragement = async () => {
        if (!encouragementConfig?.receiverId || !task || !encouragementConfig?.categoryName) {
            Alert.alert("Error", "Missing required information to send encouragement");
            return;
        }

        if (encouragementsLeft <= 0) {
            Alert.alert("Error", "You have no encouragements left today");
            return;
        }

        try {
            // Create the encouragement data
            const encouragementData = {
                receiver: encouragementConfig.receiverId,
                message: encouragementMessage.trim(),
                categoryName: encouragementConfig.categoryName,
                taskName: task.content,
            };

            // Make the API call
            await createEncouragementAPI(encouragementData);

            // Update user's encouragement count locally
            const newCount = Math.max(0, encouragementsLeft - 1);
            updateUser({ encouragements: newCount });

            // Clear message and close modal
            setEncouragementMessage("");
            setVisible(false);

            // Show success message
            Alert.alert("Success", "Encouragement sent successfully!");
        } catch (error) {
            console.error("Error sending encouragement:", error);
            Alert.alert("Error", "Failed to send encouragement. Please try again.");
        }
    };

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["55%"]}>
            <View style={styles.container}>
                {/* Task Card */}
                <View style={styles.taskCardContainer}>
                    {task && (
                        <View
                            style={[
                                styles.taskCard,
                                { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary },
                            ]}>
                            <View style={styles.taskCardContent}>
                                <ThemedText type="default" style={[styles.taskText, { color: ThemedColor.text }]}>
                                    {task.content}
                                </ThemedText>
                                <View style={styles.taskCardRight}>
                                    <ThemedText type="caption" style={[styles.taskValue, { color: ThemedColor.text }]}>
                                        {task.value}
                                    </ThemedText>
                                    <Octicons name="flame" size={24} color={ThemedColor.error} />
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Title */}
                <ThemedText type="defaultSemiBold" style={[styles.title, { color: ThemedColor.text }]}>
                    Encourage {encouragementConfig?.userHandle || "User"}
                </ThemedText>

                {/* Description */}
                <ThemedText type="lightBody" style={[styles.description, { color: ThemedColor.text }]}>
                    {encouragementConfig?.userHandle || "User"} will get a notification after sending the encouragement
                </ThemedText>

                {/* Text Input */}
                <View style={styles.inputContainer}>
                    <BottomSheetTextInput
                        placeholder={`Tap to type an encouraging message to ${encouragementConfig?.userHandle || "User"}`}
                        placeholderTextColor={ThemedColor.caption}
                        value={encouragementMessage}
                        onChangeText={setEncouragementMessage}
                        multiline={true}
                        numberOfLines={4}
                        style={[
                            styles.textInput,
                            {
                                color: ThemedColor.text,
                                borderColor: ThemedColor.tertiary,
                            },
                        ]}
                    />
                </View>

                {/* Send Button and Counter */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Send Encouragement"
                        onPress={handleSendEncouragement}
                        disabled={!encouragementMessage.trim() || encouragementsLeft === 0}
                        style={styles.sendButton}
                    />
                    <ThemedText type="caption" style={[styles.counter, { color: ThemedColor.text }]}>
                        {encouragementsLeft} Encouragements Left Today
                    </ThemedText>
                </View>
            </View>
        </DefaultModal>
    );
}

const styleSheet = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: 18,
            paddingBottom: 32,
        },
        taskCardContainer: {
            marginBottom: 16,
            width: "100%",
        },
        taskCard: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderRadius: 16,
            borderWidth: 1,
            minHeight: 55,
            justifyContent: "center",
            boxShadow: "0px 0px 5px 2px " + ThemedColor.error + "30",
        },
        taskCardContent: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        taskText: {
            flex: 1,
            textAlign: "left",
        },
        taskCardRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        taskValue: {
            fontSize: 12,
        },
        title: {
            fontSize: 24,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 24,
        },
        description: {
            fontSize: 16,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 24,
        },
        inputContainer: {
            marginBottom: 24,
            minHeight: 80,
        },
        textInput: {
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            fontSize: 16,
            fontFamily: "Outfit",
            fontWeight: "400",
            minHeight: 80,
            textAlignVertical: "top",
        },
        buttonContainer: {
            gap: 12,
            alignItems: "center",
        },
        sendButton: {
            width: "100%",
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        counter: {
            fontSize: 12,
            textAlign: "center",
        },
    });
