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
import { createCongratulationAPI } from "@/api/congratulation";

interface CongratulateModalProps {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    task?: {
        id: string;
        content: string;
        value: number;
        priority: number;
        categoryId: string;
    };
    congratulationConfig?: {
        userHandle?: string;
        receiverId: string; // ID of the user receiving the congratulation
        categoryName: string; // Name of the category the task belongs to
    };
}

export default function CongratulateModal({ visible, setVisible, task, congratulationConfig }: CongratulateModalProps) {
    const ThemedColor = useThemeColor();
    const [congratulationMessage, setCongratulationMessage] = useState("");
    const [congratulationsLeft, setCongratulationsLeft] = useState(2);

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Generate the storage key for today's date
    const getStorageKey = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        return `${day}-${month}-${year}-CON`;
    };

    // Load congratulations left from storage
    const loadCongratulationsLeft = async () => {
        try {
            const key = getStorageKey();
            const stored = await AsyncStorage.getItem(key);
            if (stored !== null) {
                const count = parseInt(stored, 10);
                setCongratulationsLeft(count);
            } else {
                // If no stored value, default to 2
                setCongratulationsLeft(2);
            }
        } catch (error) {
            console.error("Error loading congratulations left:", error);
            setCongratulationsLeft(2);
        }
    };

    // Save congratulations left to storage
    const saveCongratulationsLeft = async (count: number) => {
        try {
            const key = getStorageKey();
            await AsyncStorage.setItem(key, count.toString());
        } catch (error) {
            console.error("Error saving congratulations left:", error);
        }
    };

    // Load congratulations when modal becomes visible
    useEffect(() => {
        if (visible) {
            loadCongratulationsLeft();
        }
    }, [visible]);

    const handleSendCongratulation = async () => {
        if (!congratulationConfig?.receiverId || !task || !congratulationConfig?.categoryName) {
            Alert.alert("Error", "Missing required information to send congratulation");
            return;
        }

        try {
            // Create the congratulation data
            const congratulationData = {
                receiver: congratulationConfig.receiverId,
                message: congratulationMessage.trim(),
                categoryName: congratulationConfig.categoryName,
                taskName: task.content,
            };

            // Make the API call
            await createCongratulationAPI(congratulationData);

            // Update congratulations left
            const newCount = Math.max(0, congratulationsLeft - 1);
            setCongratulationsLeft(newCount);

            // Save to storage
            await saveCongratulationsLeft(newCount);

            // Clear message and close modal
            setCongratulationMessage("");
            setVisible(false);

            // Show success message
            Alert.alert("Success", "Congratulation sent successfully!");
        } catch (error) {
            console.error("Error sending congratulation:", error);
            Alert.alert("Error", "Failed to send congratulation. Please try again.");
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
                    Congratulate {congratulationConfig?.userHandle || "User"}
                </ThemedText>

                {/* Description */}
                <ThemedText type="lightBody" style={[styles.description, { color: ThemedColor.text }]}>
                    {congratulationConfig?.userHandle || "User"} will get a notification after sending the
                    congratulation
                </ThemedText>

                {/* Text Input */}
                <View style={styles.inputContainer}>
                    <BottomSheetTextInput
                        placeholder={`Tap to type a congratulatory message to ${congratulationConfig?.userHandle || "User"}`}
                        placeholderTextColor={ThemedColor.caption}
                        value={congratulationMessage}
                        onChangeText={setCongratulationMessage}
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
                        title="Send Congratulation"
                        onPress={handleSendCongratulation}
                        disabled={!congratulationMessage.trim() || congratulationsLeft === 0}
                        style={styles.sendButton}
                    />
                    <ThemedText type="caption" style={[styles.counter, { color: ThemedColor.text }]}>
                        {congratulationsLeft} Congratulations Left Today
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
