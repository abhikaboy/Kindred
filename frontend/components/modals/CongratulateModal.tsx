import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, Modal, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createCongratulationAPI } from "@/api/congratulation";
import { useAuth } from "@/hooks/useAuth";
import { useUserKudos } from "@/hooks/useUserKudos";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { uploadImageSmart } from "@/api/upload";
import { Images, Gif, Sparkle } from "phosphor-react-native";
import GifPicker from "./GifPicker";
import { LinearGradient } from "expo-linear-gradient";
import { Portal } from "@gorhom/portal";
import ConfettiCannon from "react-native-confetti-cannon";
import CustomAlert, { AlertButton } from "./CustomAlert";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useQueryClient } from "@tanstack/react-query";

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
        postId?: string; // Optional post ID for thumbnail
    };
}

export default function CongratulateModal({ visible, setVisible, task, congratulationConfig }: CongratulateModalProps) {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const { updateUser } = useAuth();
    const [congratulationMessage, setCongratulationMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const isMountedRef = useRef(true);
    const { pickImage } = useMediaLibrary();
    const confettiRef = useRef<any>(null);

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    // Purple glow animation
    const glowOpacity = useRef(new Animated.Value(0)).current;

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Purple glow animation effect
    useEffect(() => {
        let glowLoop: Animated.CompositeAnimation | null = null;

        if (visible) {
            // Start the pulsing animation
            glowLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowOpacity, {
                        toValue: 0.3,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowOpacity, {
                        toValue: 0.1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ])
            );
            glowLoop.start();
        } else {
            // Fade out when closing
            Animated.timing(glowOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }

        // Cleanup: stop animation on unmount or when visibility changes
        return () => {
            if (glowLoop) {
                glowLoop.stop();
            }
        };
    }, [visible]);

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
            // Don't reset showConfetti immediately - let it finish animation
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [visible]);

    const { congratulationsLeft, currentKudosRewards } = useUserKudos();
    const { capture } = useAnalytics();

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
            setAlertTitle("Error");
            setAlertMessage("Failed to select image. Please try again.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        }
    };

    const handleGifSelect = (gifUrl: string) => {
        setSelectedImage(gifUrl);
        setCongratulationMessage("");
        setShowGifPicker(false);
    };

    const handleSendCongratulation = async () => {
        if (!congratulationConfig?.receiverId || !task || !congratulationConfig?.categoryName) {
            setAlertTitle("Error");
            setAlertMessage("Missing required information to send congratulation");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        if (congratulationsLeft <= 0) {
            setAlertTitle("Error");
            setAlertMessage("You have no congratulations left today");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        // Check if either message or image is provided
        if (!congratulationMessage.trim() && !selectedImage) {
            setAlertTitle("Error");
            setAlertMessage("Please enter a message or select an image");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
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
                    setAlertTitle("Error");
                    setAlertMessage("Failed to upload image. Please try again.");
                    setAlertButtons([{ text: "OK", style: "default" }]);
                    setAlertVisible(true);
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
                ...(congratulationConfig.postId && { postId: congratulationConfig.postId }), // Include postId if available
            };

            // Make the API call
            await createCongratulationAPI(congratulationData);

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            capture(AnalyticsEvents.CONGRATULATION_SENT, {
                has_image: !!selectedImage,
            });

            setIsUploading(false);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

            // Update user's congratulation count locally
            const newCount = Math.max(0, congratulationsLeft - 1);

            updateUser({
                congratulations: newCount,
                kudosRewards: {
                    ...currentKudosRewards,
                    congratulations: currentKudosRewards.congratulations + 1
                }
            });

            // Close modal first, enable confetti, then trigger it
            setVisible(false);
            setShowConfetti(true);

            setTimeout(() => {
                if (confettiRef.current) {
                    confettiRef.current.start();
                }
                // Hide confetti after animation completes
                setTimeout(() => {
                    setShowConfetti(false);
                }, 3000);
            }, 300); // Small delay to ensure modal is closed before confetti
        } catch (error) {
            console.error("Error sending congratulation:", error);
            setIsUploading(false);
            if (isMountedRef.current) {
                setAlertTitle("Error");
                setAlertMessage("Failed to send congratulation. Please try again.");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
            }
        }
    };

    return (
        <>
            {/* Full Screen Purple Glow - Using Portal for root-level rendering */}
            {visible && (
                <Portal>
                    <Animated.View
                        style={[
                            styles.fullScreenGlowWrapper,
                            { opacity: glowOpacity }
                        ]}
                        pointerEvents="box-none"
                    >
                        {/* Top Border Glow */}
                        <LinearGradient
                            colors={['rgba(147, 51, 234, 0.8)', 'transparent']}
                            style={styles.glowBorderTop}
                            pointerEvents="none"
                        />
                        {/* Bottom Border Glow */}
                        <LinearGradient
                            colors={['transparent', 'rgba(147, 51, 234, 0.8)']}
                            style={styles.glowBorderBottom}
                            pointerEvents="none"
                        />
                        {/* Left Border Glow */}
                        <LinearGradient
                            colors={['rgba(147, 51, 234, 0.8)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.glowBorderLeft}
                            pointerEvents="none"
                        />
                        {/* Right Border Glow */}
                        <LinearGradient
                            colors={['transparent', 'rgba(147, 51, 234, 0.8)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.glowBorderRight}
                            pointerEvents="none"
                        />
                    </Animated.View>
                </Portal>
            )}

            {/* Confetti Cannon - Only show when user just sent a congratulation */}
            {showConfetti && (
                <ConfettiCannon
                    ref={confettiRef}
                    count={50}
                    origin={
                        { x: Dimensions.get("screen").width / 2,
                        y: (Dimensions.get("screen").height / 4) * 3.7 }
                    }
                    explosionSpeed={300}
                    fadeOut={true}
                    autoStart={false}
                    fallSpeed={1000}
                    colors={['#9333EA', '#A855F7', '#C084FC', '#E9D5FF']}
                />
            )}

            <DefaultModal visible={visible} setVisible={setVisible} snapPoints={selectedImage ? ["85%"] : ["55%"]}>
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
                                    <Sparkle size={24} color="#9333EA" weight="regular" />
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Title */}
                <ThemedText type="defaultSemiBold" style={styles.titleStyled}>
                    Congratulate {congratulationConfig?.userHandle || "User"}
                </ThemedText>
                <ThemedText type="captionLight" style={styles.subtitleStyled}>
                    A little goes a long way
                </ThemedText>

                {/* Text Input or Image Preview */}
                {!selectedImage ? (
                    <View style={styles.inputContainer}>
                        <BottomSheetTextInput
                            placeholder={`Write a message...`}
                            placeholderTextColor={ThemedColor.caption}
                            value={congratulationMessage}
                            onChangeText={setCongratulationMessage}
                            multiline={true}
                            numberOfLines={3}
                            style={styles.textInputStyled}
                        />
                        <View style={styles.mediaIconsRow}>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={handleImagePick}
                                disabled={isUploading}
                            >
                                <Images size={20} color={ThemedColor.caption} weight="regular" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => setShowGifPicker(true)}
                                disabled={isUploading}
                            >
                                <Gif size={20} color={ThemedColor.caption} weight="regular" />
                            </TouchableOpacity>
                        </View>
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

                {/* Send Button and Counter */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title={isUploading ? "Uploading..." : "Send Congratulation"}
                        onPress={handleSendCongratulation}
                        disabled={(!congratulationMessage.trim() && !selectedImage) || congratulationsLeft === 0 || isUploading}
                        style={styles.sendButton}
                    />
                    <ThemedText type="caption" style={styles.counterStyled}>
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

            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
        </DefaultModal>
        </>
    );
}

const styleSheet = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: 12,
            paddingBottom: 24,
        },
        taskCardContainer: {
            marginBottom: 12,
            width: "100%",
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
        taskValueStyled: {
            fontSize: 12,
            color: ThemedColor.text,
        },
        titleStyled: {
            fontSize: 24,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 4,
            color: ThemedColor.text,
        },
        subtitleStyled: {
            textAlign: "center",
            marginBottom: 16,
            color: ThemedColor.caption,
        },
        inputContainer: {
            marginBottom: 16,
        },
        textInputStyled: {
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 8,
            borderRadius: 12,
            borderWidth: 1,
            fontSize: 15,
            fontFamily: "Outfit",
            fontWeight: "400",
            minHeight: 72,
            textAlignVertical: "top",
            color: ThemedColor.text,
            borderColor: ThemedColor.tertiary,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottomWidth: 0,
        },
        mediaIconsRow: {
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: ThemedColor.tertiary,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
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
        counterStyled: {
            fontSize: 12,
            textAlign: "center",
            color: ThemedColor.text,
        },
        iconButton: {
            padding: 4,
        },
        imagePreviewContainer: {
            position: "relative",
            marginBottom: 16,
            borderRadius: 12,
            overflow: "hidden",
        },
        imagePreview: {
            width: "100%",
            height: Dimensions.get("window").height * 0.3,
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
        fullScreenGlowWrapper: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: Dimensions.get("window").width,
            height: Dimensions.get("window").height,
            backgroundColor: "transparent",
            zIndex: 999,
            elevation: 999,
        },
        glowBorderTop: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 120,
        },
        glowBorderBottom: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
        },
        glowBorderLeft: {
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 80,
        },
        glowBorderRight: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 80,
        },
    });
