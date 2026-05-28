import React, { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import LongTextInput from "@/components/inputs/LongTextInput";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { createPostToBackend } from "@/api/post";
import { uploadImageSmart, ImageUploadResult } from "@/api/upload";
import { ObjectId } from "bson";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedGroup } from "@/contexts/SelectedGroupContext";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { Ionicons } from "@expo/vector-icons";
import PostCardHeader from "@/components/cards/PostCardHeader";
import PostCardMedia from "@/components/cards/PostCardMedia";
import PostCardFooter from "@/components/cards/PostCardFooter";

export default function Caption() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const photos = params.photos ? JSON.parse(params.photos as string) : [];
    const dualPhoto = params.dualPhoto ? (params.dualPhoto as string) : null;
    const [data, setData] = useState({ caption: "" });
    const [isPosting, setIsPosting] = useState(false);
    const taskInfo = params.taskInfo ? JSON.parse(params.taskInfo as string) : null;

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const { capture } = useAnalytics();
    const { showRingUpdate } = useRingUpdate();
    const { selectedGroupId, selectedGroupName, getGroupIds } = useSelectedGroup();

    // Compute display text based on state
    const groupDisplayText = selectedGroupId === null ? "All Friends" : (selectedGroupName || "Selected Group");

    const hasActualPhotos = photos.length > 0;
    const handleCaptionChange = (text: string) => {
        setData({
            ...data,
            caption: text,
        });
    };

    const uploadPhotos = async (photoUris: string[], dualUri: string | null): Promise<{ urls: string[]; sizeInfo?: { width: number; height: number; bytes: number }; dualUrl?: string }> => {
        if (!hasActualPhotos) {
            return { urls: [] };
        }
        const uploadedUrls = [];
        let sizeInfo: { width: number; height: number; bytes: number } | undefined;

        for (let i = 0; i < photoUris.length; i++) {
            try {
                const result = await uploadImageSmart(
                    "post",
                    taskInfo?.id || new ObjectId().toString(),
                    photoUris[i],
                    { variant: "large", returnFullResult: true }
                ) as ImageUploadResult;

                uploadedUrls.push(result.public_url);

                // Use the size info from the first image (primary image)
                if (i === 0) {
                    sizeInfo = {
                        width: result.width,
                        height: result.height,
                        bytes: result.size
                    };
                }
            } catch (error) {
                console.error(`Failed to upload photo ${i + 1}:`, error);
                throw new Error(`Failed to upload photo ${i + 1}. Please try again.`);
            }
        }

        // Upload dual photo if it exists
        let dualUrl: string | undefined;
        if (dualUri) {
            try {
                const dualResult = await uploadImageSmart(
                    "post",
                    taskInfo?.id || new ObjectId().toString(),
                    dualUri,
                    { variant: "medium", returnFullResult: true }
                ) as ImageUploadResult;
                dualUrl = dualResult.public_url;
            } catch (error) {
                console.error('Failed to upload dual photo:', error);
                // Continue without dual photo rather than failing
            }
        }

        return { urls: uploadedUrls, sizeInfo, dualUrl };
    };
    const handlePost = async () => {
        if (!data.caption.trim()) {
            setAlertTitle("Error");
            setAlertMessage("Please add a caption");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        setIsPosting(true);

        try {
            const uploadResult = await uploadPhotos(hasActualPhotos ? photos : [], dualPhoto);
            const taskReference = taskInfo
                ? {
                      id: taskInfo.id,
                      content: taskInfo.name,
                      category: {
                          id: taskInfo.category,
                          name: taskInfo.categoryName || "Unknown Category",
                      },
                  }
                : undefined;

            const selectedGroups = getGroupIds();

            const result = await createPostToBackend(
                uploadResult.urls,
                data.caption,
                taskReference,
                undefined,
                taskInfo?.public ?? false,
                uploadResult.sizeInfo,
                selectedGroups,
                uploadResult.dualUrl
            );

            // Update user stats locally if available
            if (result.userStats) {
                updateUser({
                    posts_made: result.userStats.posts_made,
                    points: result.userStats.points
                });
            }

            showRingUpdate(result.ringDelta);

            capture(AnalyticsEvents.POST_CREATED, {
                has_caption: !!data.caption?.trim(),
            });

            router.dismissAll();
            router.push(`/(logged-in)/posting/${result.post._id}`);
        } catch (error) {
            console.error("Error creating post:", error);

            let errorMessage = "Failed to create post. Please try again.";
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            setAlertTitle("Error");
            setAlertMessage(errorMessage);
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingTop: insets.top,
                        paddingBottom: 24 + insets.bottom,
                    }}
                    keyboardShouldPersistTaps="handled">
                    {/* Header with back button */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                        }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            activeOpacity={0.7}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: ThemedColor.lightened,
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                            <Ionicons name="arrow-back" size={20} color={ThemedColor.text} />
                        </TouchableOpacity>
                        <ThemedText type="subtitle" style={{ marginLeft: 12 }}>
                            New Post
                        </ThemedText>
                    </View>

                    {/* Post preview card */}
                    <View style={{ paddingHorizontal: 16 }}>
                        <View
                            style={{
                                borderRadius: 16,
                                overflow: "hidden",
                                backgroundColor: ThemedColor.background,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.15,
                                shadowRadius: 12,
                                elevation: 6,
                            }}>
                            <PostCardHeader
                                icon={user?.profile_picture}
                                name={user?.display_name ?? "You"}
                                username={user?.handle ? `${user.handle}` : undefined}
                                timeLabel="Just now"
                                disableNavigation
                            />
                            {hasActualPhotos && (
                                <PostCardMedia
                                    images={photos}
                                    dual={dualPhoto}
                                />
                            )}
                            <PostCardFooter
                                category={taskInfo?.categoryName}
                                taskName={taskInfo?.name}
                                readOnly
                            />
                        </View>
                    </View>

                    {/* Caption and options */}
                    <View style={{ padding: 16, gap: 12 }}>
                        <LongTextInput
                            placeholder="Enter a caption"
                            value={data.caption}
                            setValue={handleCaptionChange}
                            fontSize={16}
                            minHeight={120}
                        />
                        <View
                            style={{
                                width: "100%",
                                padding: 20,
                                justifyContent: "space-between",
                                backgroundColor: ThemedColor.lightened,
                                borderRadius: 8,
                                flexDirection: "row",
                            }}>
                            <ThemedText>Points Gained</ThemedText>
                            <ThemedText>{taskInfo?.points || 1} points</ThemedText>
                        </View>
                        <TouchableOpacity
                            style={{
                                width: "100%",
                                padding: 20,
                                justifyContent: "space-between",
                                backgroundColor: ThemedColor.lightened,
                                borderRadius: 8,
                                flexDirection: "row",
                            }}
                            onPress={() => {
                                router.push("/(logged-in)/posting/groups");
                            }}
                            activeOpacity={0.7}>
                            <ThemedText>Who can see this post?</ThemedText>
                            <ThemedText>{groupDisplayText}</ThemedText>
                        </TouchableOpacity>
                        <PrimaryButton
                            title={isPosting ? "Posting..." : "Post"}
                            onPress={handlePost}
                            disabled={isPosting}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
        </ThemedView>
    );
}
