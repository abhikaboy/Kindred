import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createCongratulationAPI } from "@/api/congratulation";
import { useAuth } from "@/hooks/useAuth";

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
    const { user, updateUser } = useAuth();
    const [congratulationMessage, setCongratulationMessage] = useState("");
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

    // Get congratulations left from user data
    const congratulationsLeft = user?.congratulations || 0;

    const handleSendCongratulation = async () => {
        if (!congratulationConfig?.receiverId || !task || !congratulationConfig?.categoryName) {
            Alert.alert("Error", "Missing required information to send congratulation");
            return;
        }

        if (congratulationsLeft <= 0) {
            Alert.alert("Error", "You have no congratulations left today");
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

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            // Update user's congratulation count locally
            const newCount = Math.max(0, congratulationsLeft - 1);
            updateUser({ congratulations: newCount });

            // Show success message first, then close modal
            Alert.alert(
                "Success", 
                "Congratulation sent successfully!",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            // Clear message and close modal after user dismisses alert
                            if (isMountedRef.current) {
                                setCongratulationMessage("");
                                setVisible(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error("Error sending congratulation:", error);
            if (isMountedRef.current) {
                Alert.alert("Error", "Failed to send congratulation. Please try again.");
            }
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
