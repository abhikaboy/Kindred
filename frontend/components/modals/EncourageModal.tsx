import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import Octicons from "@expo/vector-icons/Octicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEncouragementAPI } from "@/api/encouragement";

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
    const [encouragementMessage, setEncouragementMessage] = useState("");
    const [encouragementsLeft, setEncouragementsLeft] = useState(2);

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Generate the storage key for today's date
    const getStorageKey = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        return `${day}-${month}-${year}-ENC`;
    };

    // Load encouragements left from storage
    const loadEncouragementsLeft = async () => {
        try {
            const key = getStorageKey();
            const stored = await AsyncStorage.getItem(key);
            if (stored !== null) {
                const count = parseInt(stored, 10);
                setEncouragementsLeft(count);
            } else {
                // If no stored value, default to 2
                setEncouragementsLeft(2);
            }
        } catch (error) {
            console.error("Error loading encouragements left:", error);
            setEncouragementsLeft(2);
        }
    };

    // Save encouragements left to storage
    const saveEncouragementsLeft = async (count: number) => {
        try {
            const key = getStorageKey();
            await AsyncStorage.setItem(key, count.toString());
        } catch (error) {
            console.error("Error saving encouragements left:", error);
        }
    };

    // Load encouragements when modal becomes visible
    useEffect(() => {
        if (visible) {
            loadEncouragementsLeft();
        }
    }, [visible]);

    const handleSendEncouragement = async () => {
        if (!encouragementConfig?.receiverId || !task || !encouragementConfig?.categoryName) {
            Alert.alert("Error", "Missing required information to send encouragement");
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

            // Update encouragements left
            const newCount = Math.max(0, encouragementsLeft - 1);
            setEncouragementsLeft(newCount);

            // Save to storage
            await saveEncouragementsLeft(newCount);

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
