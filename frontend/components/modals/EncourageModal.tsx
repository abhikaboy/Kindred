import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, Modal, Animated, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Octicons from "@expo/vector-icons/Octicons";
import { createEncouragementAPI } from "@/api/encouragement";
import type { components } from "@/api/generated/types";
type CreateEncouragementParams = components["schemas"]["CreateEncouragementParams"];
import { useAuth } from "@/hooks/useAuth";
import { useUserKudos } from "@/hooks/useUserKudos";
import { useMediaLibrary, IMAGE_AND_VIDEO_TYPES } from "@/hooks/useMediaLibrary";
import { uploadImageSmart, uploadVideo, KUDOS_VIDEO_MAX_BYTES, KUDOS_VIDEO_MAX_DURATION_MS } from "@/api/upload";
import { Images, Gif, Sparkle, VideoCamera } from "phosphor-react-native";
import GifPicker from "./GifPicker";
import KudosVideoRecorder from "./KudosVideoRecorder";
import KudosVideoPreview from "./KudosVideoPreview";
import { formatVideoDuration } from "@/api/media";
import { LinearGradient } from "expo-linear-gradient";
import { Portal } from "@gorhom/portal";
import ConfettiCannon from "react-native-confetti-cannon";
import CustomAlert, { AlertButton } from "./CustomAlert";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { useKudosSent } from "@/contexts/kudosSentContext";

type SelectedKudosMedia = { uri: string; type: "image" | "video"; durationMs?: number };

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
    defaultMessage?: string; // Pre-filled encouragement message (e.g. for ring encouragements)
}

export default function EncourageModal({ visible, setVisible, task, encouragementConfig, isProfileLevel = false, defaultMessage }: EncourageModalProps) {
    const ThemedColor = useThemeColor();
    const { updateUser } = useAuth();
    const { capture } = useAnalytics();
    const queryClient = useQueryClient();
    const { showRingUpdate } = useRingUpdate();
    const { showKudosSent } = useKudosSent();
    const [encouragementMessage, setEncouragementMessage] = useState("");
    const [selectedMedia, setSelectedMedia] = useState<SelectedKudosMedia | null>(null);
    const [showRecorder, setShowRecorder] = useState(false);
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

    // Pre-fill message when modal opens with a default
    useEffect(() => {
        if (visible && defaultMessage && encouragementMessage === "") {
            setEncouragementMessage(defaultMessage);
        }
    }, [visible, defaultMessage]);

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
            setEncouragementMessage("");
            setSelectedMedia(null);
            setShowRecorder(false);
            setIsUploading(false);
            setShowGifPicker(false);
            // Don't reset showConfetti immediately - let it finish animation
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [visible]);

    const { encouragementsLeft, currentKudosRewards } = useUserKudos();

    const handleMediaPick = async () => {
        try {
            const result = await pickImage({
                mediaTypes: IMAGE_AND_VIDEO_TYPES,
                allowsEditing: true,
                quality: 0.7,
                videoMaxDuration: KUDOS_VIDEO_MAX_DURATION_MS / 1000,
            });

            if (result && !result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                if (asset.type === "video") {
                    // iOS trims via allowsEditing; Android ignores videoMaxDuration
                    // for library picks, so enforce the cap here. duration is ms.
                    if (!asset.duration) {
                        setAlertTitle("Error");
                        setAlertMessage("Couldn't read the video's length. Please try a different video.");
                        setAlertButtons([{ text: "OK", style: "default" }]);
                        setAlertVisible(true);
                        return;
                    }
                    if (asset.duration > KUDOS_VIDEO_MAX_DURATION_MS) {
                        setAlertTitle("Video too long");
                        setAlertMessage("Videos can be up to 30 seconds.");
                        setAlertButtons([{ text: "OK", style: "default" }]);
                        setAlertVisible(true);
                        return;
                    }
                    setSelectedMedia({ uri: asset.uri, type: "video", durationMs: asset.duration });
                } else {
                    setSelectedMedia({ uri: asset.uri, type: "image" });
                }
                // Clear message when media is selected
                setEncouragementMessage("");
            }
        } catch (error) {
            console.error("Error picking media:", error);
            setAlertTitle("Error");
            setAlertMessage("Failed to select media. Please try again.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        }
    };

    const handleGifSelect = (gifUrl: string) => {
        setSelectedMedia({ uri: gifUrl, type: "image" });
        setEncouragementMessage("");
        setShowGifPicker(false);
    };

    const handleSendEncouragement = async () => {
        // Validation for profile vs task level
        if (isProfileLevel) {
            if (!encouragementConfig?.receiverId) {
                setAlertTitle("Error");
                setAlertMessage("Missing required information to send encouragement");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
        } else {
            if (!encouragementConfig?.receiverId || !task || !encouragementConfig?.categoryName) {
                setAlertTitle("Error");
                setAlertMessage("Missing required information to send encouragement");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
        }

        if (encouragementsLeft <= 0) {
            setAlertTitle("Error");
            setAlertMessage("You have no encouragements left today");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        // Check if either message or media is provided
        if (!encouragementMessage.trim() && !selectedMedia) {
            setAlertTitle("Error");
            setAlertMessage("Please enter a message or select an image");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        try {
            setIsUploading(true);

            let contentToSend = encouragementMessage.trim();
            let encouragementType = "message";
            let thumbnailUrl: string | undefined;
            let durationMs: number | undefined;

            if (selectedMedia) {
                try {
                    if (selectedMedia.type === "video") {
                        const tempId = `encouragement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const media = await uploadVideo("encouragement", tempId, selectedMedia.uri, {
                            maxBytes: KUDOS_VIDEO_MAX_BYTES,
                            durationMs: selectedMedia.durationMs,
                        });
                        contentToSend = media.url;
                        thumbnailUrl = media.thumbnailUrl ?? undefined;
                        durationMs = media.durationMs ?? selectedMedia.durationMs;
                        encouragementType = "video";
                    } else if (selectedMedia.uri.startsWith("http://") || selectedMedia.uri.startsWith("https://")) {
                        // GIF URL from Tenor — use it directly
                        contentToSend = selectedMedia.uri;
                        encouragementType = "image";
                    } else {
                        // Local image — upload it
                        const tempId = `encouragement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const imageUrl = await uploadImageSmart("encouragement", tempId, selectedMedia.uri, {
                            variant: "large",
                        });
                        contentToSend = typeof imageUrl === "string" ? imageUrl : imageUrl.public_url;
                        encouragementType = "image";
                    }
                } catch (uploadError) {
                    console.error("Error uploading media:", uploadError);
                    setIsUploading(false);
                    setAlertTitle("Error");
                    setAlertMessage(
                        uploadError instanceof Error && uploadError.message.includes("too large")
                            ? uploadError.message
                            : "Failed to upload media. Please try again."
                    );
                    setAlertButtons([{ text: "OK", style: "default" }]);
                    setAlertVisible(true);
                    return;
                }
            }

            // Create the encouragement data based on scope
            const encouragementData: CreateEncouragementParams = isProfileLevel
                ? {
                    receiver: encouragementConfig.receiverId,
                    message: contentToSend,
                    scope: "profile" as const,
                    type: encouragementType,
                    ...(thumbnailUrl && { thumbnailUrl }),
                    ...(durationMs && { durationMs }),
                }
                : {
                    receiver: encouragementConfig.receiverId,
                    message: contentToSend,
                    scope: "task" as const,
                    categoryName: encouragementConfig.categoryName,
                    taskName: task!.content,
                    taskId: task!.id,
                    type: encouragementType,
                    ...(thumbnailUrl && { thumbnailUrl }),
                    ...(durationMs && { durationMs }),
                };

            // Make the API call
            const encouragementResult = await createEncouragementAPI(encouragementData);

            // Only update state if component is still mounted
            if (!isMountedRef.current) return;

            setIsUploading(false);
            showRingUpdate(encouragementResult?.ringDelta);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

            capture(AnalyticsEvents.ENCOURAGEMENT_SENT, {
                has_message: !!encouragementMessage?.trim(),
                has_image: selectedMedia?.type === "image",
                has_video: selectedMedia?.type === "video",
            });

            // Update user's encouragement count locally
            const newCount = Math.max(0, encouragementsLeft - 1);

            updateUser({
                encouragements: newCount,
                kudosRewards: {
                    ...currentKudosRewards,
                    encouragements: currentKudosRewards.encouragements + 1
                }
            });

            // Haptic feedback on successful send
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Show the global "kudos sent" overlay. Media sends have no text body.
            showKudosSent({
                recipientName: encouragementConfig?.userHandle || "them",
                message: selectedMedia
                    ? selectedMedia.type === "video"
                        ? "Sent a video"
                        : "Sent an image"
                    : encouragementMessage.trim(),
                kind: "encouragement",
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
                setAlertTitle("Error");
                setAlertMessage("Failed to send encouragement. Please try again.");
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

            {/* Confetti Cannon - Full screen overlay, same as task completion */}
            {showConfetti && (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, height: Dimensions.get("screen").height }} pointerEvents="none">
                    <ConfettiCannon
                        ref={confettiRef}
                        count={50}
                        origin={{
                            x: Dimensions.get("screen").width / 2,
                            y: (Dimensions.get("screen").height / 4) * 3.7,
                        }}
                        explosionSpeed={300}
                        fadeOut={true}
                        autoStart={false}
                        fallSpeed={1200}
                    />
                </View>
            )}

            <DefaultModal visible={visible} setVisible={setVisible} snapPoints={selectedMedia ? ["85%"] : ["55%"]}>
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
                    {isProfileLevel ? "Send Encouragement" : `Encourage ${encouragementConfig?.userHandle || "User"}`}
                </ThemedText>
                <ThemedText type="captionLight" style={styles.subtitleStyled}>
                    A little goes a long way
                </ThemedText>

                {/* Text Input or Media Preview */}
                {!selectedMedia ? (
                    <View style={styles.inputContainer}>
                        <BottomSheetTextInput
                            placeholder="Write a message..."
                            placeholderTextColor={ThemedColor.caption}
                            value={encouragementMessage}
                            onChangeText={setEncouragementMessage}
                            multiline={true}
                            numberOfLines={3}
                            style={styles.textInputStyled}
                        />
                        <View style={styles.mediaIconsRow}>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={handleMediaPick}
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
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => setShowRecorder(true)}
                                disabled={isUploading}
                            >
                                <VideoCamera size={20} color={ThemedColor.caption} weight="regular" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : selectedMedia.type === "video" ? (
                    <View style={styles.imagePreviewContainer}>
                        <View style={styles.videoPreview}>
                            <KudosVideoPreview uri={selectedMedia.uri} />
                        </View>
                        {selectedMedia.durationMs ? (
                            <View style={styles.durationPill}>
                                <ThemedText type="caption" style={{ color: "#fff", fontSize: 12 }}>
                                    {formatVideoDuration(selectedMedia.durationMs)}
                                </ThemedText>
                            </View>
                        ) : null}
                        <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => setSelectedMedia(null)}
                        >
                            <Octicons name="x" size={20} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.imagePreviewContainer}
                        onPress={handleMediaPick}
                        activeOpacity={0.9}
                    >
                        <Image source={{ uri: selectedMedia.uri }} style={styles.imagePreview} resizeMode="contain" />
                        <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                setSelectedMedia(null);
                            }}
                        >
                            <Octicons name="x" size={20} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}

                {/* Send Button and Counter */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title={isUploading ? "Uploading..." : "Send Encouragement"}
                        onPress={handleSendEncouragement}
                        disabled={(!encouragementMessage.trim() && !selectedMedia) || encouragementsLeft === 0 || isUploading}
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

            <KudosVideoRecorder
                visible={showRecorder}
                onClose={() => setShowRecorder(false)}
                onRecorded={({ uri, durationMs: recordedMs }) => {
                    setSelectedMedia({ uri, type: "video", durationMs: recordedMs });
                    setEncouragementMessage("");
                    setShowRecorder(false);
                }}
            />

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
        counter: {
            fontSize: 12,
            textAlign: "center",
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
        videoPreview: {
            width: "100%",
            height: Dimensions.get("window").height * 0.3,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: "#000",
        },
        durationPill: {
            position: "absolute",
            bottom: 8,
            left: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 2,
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
