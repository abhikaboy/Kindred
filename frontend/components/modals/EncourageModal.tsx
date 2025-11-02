import React, { useState, useMemo, useRef, useEffect } from "react";
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
    const isMountedRef = useRef(true);

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Track mounted state and reset when modal opens
    useEffect(() => {
        if (visible) {
            isMountedRef.current = true;
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [visible]);

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
                type: "message", // Type of encouragement (message or image)
            };

            // Make the API call
            await createEncouragementAPI(encouragementData);

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            // Update user's encouragement count locally
            const newCount = Math.max(0, encouragementsLeft - 1);
            updateUser({ encouragements: newCount });

            // Show success message first, then close modal
            Alert.alert(
                "Success", 
                "Encouragement sent successfully!",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            // Clear message and close modal after user dismisses alert
                            if (isMountedRef.current) {
                                setEncouragementMessage("");
                                setVisible(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error("Error sending encouragement:", error);
            if (isMountedRef.current) {
                Alert.alert("Error", "Failed to send encouragement. Please try again.");
            }
        }
    };

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["55%"]}>
            <View style={styles.container}>
                {/* Task Card */}
                <View style={styles.taskCardContainer}>
                    {task && (
                        <View style={styles.taskCardStyled}>
                            <View style={styles.taskCardContent}>
                                <ThemedText type="default" style={styles.taskTextStyled}>
                                    {task.content}
                                </ThemedText>
                                <View style={styles.taskCardRight}>
                                    <ThemedText type="caption" style={styles.taskValueStyled}>
                                        {task.value}
                                    </ThemedText>
                                    <Octicons name="flame" size={24} color={ThemedColor.error} />
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Title */}
                <ThemedText type="defaultSemiBold" style={styles.titleStyled}>
                    Encourage {encouragementConfig?.userHandle || "User"}
                </ThemedText>

                {/* Description */}
                <ThemedText type="lightBody" style={styles.descriptionStyled}>
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
                        style={styles.textInputStyled}
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
                    <ThemedText type="caption" style={styles.counterStyled}>
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
        taskCardStyled: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderRadius: 16,
            borderWidth: 1,
            minHeight: 55,
            justifyContent: "center",
            backgroundColor: ThemedColor.lightened,
            borderColor: ThemedColor.tertiary,
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
        taskTextStyled: {
            flex: 1,
            textAlign: "left",
            color: ThemedColor.text,
        },
        taskCardRight: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },
        taskValue: {
            fontSize: 12,
        },
        taskValueStyled: {
            fontSize: 12,
            color: ThemedColor.text,
        },
        title: {
            fontSize: 24,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 24,
        },
        titleStyled: {
            fontSize: 24,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 24,
            color: ThemedColor.text,
        },
        description: {
            fontSize: 16,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 24,
        },
        descriptionStyled: {
            fontSize: 16,
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 24,
            color: ThemedColor.text,
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
        textInputStyled: {
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            fontSize: 16,
            fontFamily: "Outfit",
            fontWeight: "400",
            minHeight: 80,
            textAlignVertical: "top",
            color: ThemedColor.text,
            borderColor: ThemedColor.tertiary,
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
        counterStyled: {
            fontSize: 12,
            textAlign: "center",
            color: ThemedColor.text,
        },
    });