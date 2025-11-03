import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Image, Dimensions, Modal } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createCongratulationAPI } from "@/api/congratulation";
import { useAuth } from "@/hooks/useAuth";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { uploadImageSmart } from "@/api/upload";
import { Images, Gif } from "phosphor-react-native";
import GifPicker from "./GifPicker";

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
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const isMountedRef = useRef(true);
    const { pickImage } = useMediaLibrary();

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Track mounted state and reset when modal opens
    useEffect(() => {
        if (visible) {
            isMountedRef.current = true;
        } else {
            // Reset state when modal closes
            setCongratulationMessage("");
            setSelectedImage(null);
            setIsUploading(false);
            setShowGifPicker(false);
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [visible]);

    // Get congratulations left from user data
    const congratulationsLeft = user?.congratulations || 0;

    const handleImagePick = async () => {
        try {
            const result = await pickImage({
                allowsEditing: true,
                quality: 0.7,
            });

            if (result && !result.canceled && result.assets && result.assets[0]) {
                const imageUri = result.assets[0].uri;
                setSelectedImage(imageUri);
                // Clear message when image is selected
                setCongratulationMessage("");
            }
        } catch (error) {
            console.error("Error picking image:", error);
            Alert.alert("Error", "Failed to select image. Please try again.");
        }
    };

    const handleGifSelect = (gifUrl: string) => {
        setSelectedImage(gifUrl);
        setCongratulationMessage("");
        setShowGifPicker(false);
    };

    const handleSendCongratulation = async () => {
        if (!congratulationConfig?.receiverId || !task || !congratulationConfig?.categoryName) {
            Alert.alert("Error", "Missing required information to send congratulation");
            return;
        }

        if (congratulationsLeft <= 0) {
            Alert.alert("Error", "You have no congratulations left today");
            return;
        }

        // Check if either message or image is provided
        if (!congratulationMessage.trim() && !selectedImage) {
            Alert.alert("Error", "Please enter a message or select an image");
            return;
        }

        try {
            setIsUploading(true);

            let contentToSend = congratulationMessage.trim();
            let congratulationType = "message";

            // If image is selected, upload it first (unless it's a GIF URL)
            if (selectedImage) {
                try {
                    // Check if it's a URL (GIF from Tenor) or a local file (uploaded image)
                    if (selectedImage.startsWith('http://') || selectedImage.startsWith('https://')) {
                        // It's a GIF URL, use it directly
                        contentToSend = selectedImage;
                        congratulationType = "image";
                    } else {
                        // It's a local image, upload it
                        const tempId = `congratulation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        const imageUrl = await uploadImageSmart("congratulation", tempId, selectedImage, {
                            variant: "large",
                        });
                        
                        contentToSend = typeof imageUrl === 'string' ? imageUrl : imageUrl.public_url;
                        congratulationType = "image";
                    }
                } catch (uploadError) {
                    console.error("Error uploading image:", uploadError);
                    setIsUploading(false);
                    Alert.alert("Error", "Failed to upload image. Please try again.");
                    return;
                }
            }

            // Create the congratulation data
            const congratulationData = {
                receiver: congratulationConfig.receiverId,
                message: contentToSend,
                categoryName: congratulationConfig.categoryName,
                taskName: task.content,
                type: congratulationType,
            };

            // Make the API call
            await createCongratulationAPI(congratulationData);

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            setIsUploading(false);

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
                            // Clear state and close modal after user dismisses alert
                            if (isMountedRef.current) {
                                setVisible(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error("Error sending congratulation:", error);
            setIsUploading(false);
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

                {/* Text Input or Image Preview */}
                {!selectedImage ? (
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
                ) : (
                    <TouchableOpacity 
                        style={styles.imagePreviewContainer}
                        onPress={handleImagePick}
                        activeOpacity={0.9}
                    >
                        <Image source={{ uri: selectedImage }} style={styles.imagePreview} resizeMode="contain" />
                        <TouchableOpacity 
                            style={styles.removeImageButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                setSelectedImage(null);
                            }}
                        >
                            <Octicons name="x" size={20} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}

                {/* Media Icons */}
                <View style={styles.mediaIconsContainerWrapper}>
                    <View style={styles.mediaIconsContainer}>
                        <TouchableOpacity 
                            style={styles.iconButton}
                            onPress={handleImagePick}
                            disabled={isUploading}
                        >
                            <Images size={32} color={ThemedColor.text} weight="regular" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.iconButton}
                            onPress={() => setShowGifPicker(true)}
                            disabled={isUploading}
                        >
                            <Gif size={32} color={ThemedColor.text} weight="regular" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Send Button and Counter */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title={isUploading ? "Uploading..." : "Send Congratulation"}
                        onPress={handleSendCongratulation}
                        disabled={(!congratulationMessage.trim() && !selectedImage) || congratulationsLeft === 0 || isUploading}
                        style={styles.sendButton}
                    />
                    <ThemedText type="caption" style={[styles.counter, { color: ThemedColor.text }]}>
                        {congratulationsLeft} Congratulations Left Today
                    </ThemedText>
                </View>
            </View>

            {/* GIF Picker Modal */}
            <Modal
                visible={showGifPicker}
                animationType="slide"
                onRequestClose={() => setShowGifPicker(false)}
            >
                <View style={styles.gifPickerContainer}>
                    <View style={[styles.gifPickerHeader, { backgroundColor: ThemedColor.background, borderBottomColor: ThemedColor.tertiary }]}>
                        <ThemedText type="defaultSemiBold" style={styles.gifPickerTitle}>
                            Select a GIF
                        </ThemedText>
                        <TouchableOpacity onPress={() => setShowGifPicker(false)}>
                            <Octicons name="x" size={24} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>
                    <GifPicker onGifSelect={handleGifSelect} />
                </View>
            </Modal>
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
        mediaIconsContainerWrapper: {
            width: "100%",
            marginBottom: 24,
        },
        mediaIconsContainer: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 12,
            alignSelf: "flex-end",
        },
        iconButton: {
            padding: 0,
        },
        imagePreviewContainer: {
            position: "relative",
            marginBottom: 16,
            borderRadius: 12,
            overflow: "hidden",
        },
        imagePreview: {
            width: "100%",
            height: Dimensions.get("window").height * 0.5,
            resizeMode: "contain",
        },
        removeImageButton: {
            position: "absolute",
            top: 8,
            right: 8,
            borderRadius: 20,
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
        },
        gifPickerContainer: {
            flex: 1,
        },
        gifPickerHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            paddingTop: 50,
        },
        gifPickerTitle: {
            fontSize: 18,
        },
    });
