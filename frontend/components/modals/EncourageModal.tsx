import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Image, Dimensions, Modal, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createEncouragementAPI } from "@/api/encouragement";
import { useAuth } from "@/hooks/useAuth";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { uploadImageSmart } from "@/api/upload";
import { Images, Gif, Sparkle } from "phosphor-react-native";
import GifPicker from "./GifPicker";
import { LinearGradient } from "expo-linear-gradient";
import { Portal } from "@gorhom/portal";
import ConfettiCannon from "react-native-confetti-cannon";

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
    isProfileLevel?: boolean; // New prop to indicate profile-level encouragement
}

export default function EncourageModal({ visible, setVisible, task, encouragementConfig, isProfileLevel = false }: EncourageModalProps) {
    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const [encouragementMessage, setEncouragementMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const isMountedRef = useRef(true);
    const { pickImage } = useMediaLibrary();
    const confettiRef = useRef<any>(null);

    // Purple glow animation
    const glowOpacity = useRef(new Animated.Value(0)).current;

    const styles = useMemo(() => styleSheet(ThemedColor), [ThemedColor]);

    // Purple glow animation effect
    useEffect(() => {
        if (visible) {
            // Start the pulsing animation
            Animated.loop(
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
            ).start();
        } else {
            // Fade out when closing
            Animated.timing(glowOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Track mounted state and reset when modal opens
    useEffect(() => {
        if (visible) {
            isMountedRef.current = true;
        } else {
            // Reset state when modal closes
            setEncouragementMessage("");
            setSelectedImage(null);
            setIsUploading(false);
            setShowGifPicker(false);
            // Don't reset showConfetti immediately - let it finish animation
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [visible]);

    // Get encouragements left from user data
    const encouragementsLeft = user?.encouragements || 0;

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
                setEncouragementMessage("");
            }
        } catch (error) {
            console.error("Error picking image:", error);
            Alert.alert("Error", "Failed to select image. Please try again.");
        }
    };

    const handleGifSelect = (gifUrl: string) => {
        setSelectedImage(gifUrl);
        setEncouragementMessage("");
        setShowGifPicker(false);
    };

    const handleSendEncouragement = async () => {
        // Validation for profile vs task level
        if (isProfileLevel) {
            if (!encouragementConfig?.receiverId) {
                Alert.alert("Error", "Missing required information to send encouragement");
                return;
            }
        } else {
            if (!encouragementConfig?.receiverId || !task || !encouragementConfig?.categoryName) {
                Alert.alert("Error", "Missing required information to send encouragement");
                return;
            }
        }

        if (encouragementsLeft <= 0) {
            Alert.alert("Error", "You have no encouragements left today");
            return;
        }

        // Check if either message or image is provided
        if (!encouragementMessage.trim() && !selectedImage) {
            Alert.alert("Error", "Please enter a message or select an image");
            return;
        }

        try {
            setIsUploading(true);

            let contentToSend = encouragementMessage.trim();
            let encouragementType = "message";

            // If image is selected, upload it first (unless it's a GIF URL)
            if (selectedImage) {
                try {
                    // Check if it's a URL (GIF from Tenor) or a local file (uploaded image)
                    if (selectedImage.startsWith('http://') || selectedImage.startsWith('https://')) {
                        // It's a GIF URL, use it directly
                        contentToSend = selectedImage;
                        encouragementType = "image";
                    } else {
                        // It's a local image, upload it
                        const tempId = `encouragement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        const imageUrl = await uploadImageSmart("encouragement", tempId, selectedImage, {
                            variant: "large",
                        });
                        
                        contentToSend = typeof imageUrl === 'string' ? imageUrl : imageUrl.public_url;
                        encouragementType = "image";
                    }
                } catch (uploadError) {
                    console.error("Error uploading image:", uploadError);
                    setIsUploading(false);
                    Alert.alert("Error", "Failed to upload image. Please try again.");
                    return;
                }
            }

            // Create the encouragement data based on scope
            const encouragementData = isProfileLevel
                ? {
                    receiver: encouragementConfig.receiverId,
                    message: contentToSend,
                    scope: "profile" as const,
                    type: encouragementType,
                }
                : {
                    receiver: encouragementConfig.receiverId,
                    message: contentToSend,
                    scope: "task" as const,
                    categoryName: encouragementConfig.categoryName,
                    taskName: task!.content,
                    taskId: task!.id,
                    type: encouragementType,
                };

            // Make the API call
            await createEncouragementAPI(encouragementData as any);

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            setIsUploading(false);

            // Update user's encouragement count locally
            const newCount = Math.max(0, encouragementsLeft - 1);
            
            // Also increment kudosRewards.encouragements for rewards tracking
            const currentKudosRewards = user?.kudosRewards || { encouragements: 0, congratulations: 0 };
            updateUser({ 
                encouragements: newCount,
                kudosRewards: {
                    ...currentKudosRewards,
                    encouragements: currentKudosRewards.encouragements + 1
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
            console.error("Error sending encouragement:", error);
            setIsUploading(false);
            if (isMountedRef.current) {
                Alert.alert("Error", "Failed to send encouragement. Please try again.");
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

            {/* Confetti Cannon - Only show when user just sent an encouragement */}
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
            
            <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["55%"]}>
                <View style={styles.container}>
                {/* Task Card - Only show for task-level encouragements */}
                {!isProfileLevel && (
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
                )}

                {/* Title */}
                <ThemedText type="defaultSemiBold" style={styles.titleStyled}>
                    {isProfileLevel ? "Send Profile Encouragement" : `Encourage ${encouragementConfig?.userHandle || "User"}`}
                </ThemedText>

                {/* Description */}
                <ThemedText type="lightBody" style={styles.descriptionStyled}>
                    {isProfileLevel 
                        ? `Send a personal encouragement to ${encouragementConfig?.userHandle || "User"}!`
                        : `${encouragementConfig?.userHandle || "User"} will get a notification after sending the encouragement`
                    }
                </ThemedText>

                {/* Text Input or Image Preview */}
                {!selectedImage ? (
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
                        title={isUploading ? "Uploading..." : "Send Encouragement"}
                        onPress={handleSendEncouragement}
                        disabled={(!encouragementMessage.trim() && !selectedImage) || encouragementsLeft === 0 || isUploading}
                        style={styles.sendButton}
                    />
                    <ThemedText type="caption" style={styles.counterStyled}>
                        {encouragementsLeft} Encouragements Left Today
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
        </>
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
            boxShadow: "0px 0px 5px 2px " + "#9333EA" + "30",
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