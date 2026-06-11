import React, { useState, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import MentionTextInput from "@/components/inputs/MentionTextInput";
import TaggedUsersChips, { TaggedUser } from "@/components/inputs/TaggedUsersChips";
import { formatHandle } from "@/utils/handle";
import { createPostToBackend } from "@/api/post";
import { uploadImageSmart, uploadVideo, ImageUploadResult } from "@/api/upload";
import type { MediaItem } from "@/api/media";
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
import { usePostComposer } from "@/contexts/PostComposerContext";
import { getEncouragementsByTask } from "@/api/encouragement";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";
import type { Href } from "expo-router";

export default function Caption() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const photos = params.photos ? JSON.parse(params.photos as string) : [];
    const mediaTypesByUri: Record<string, "image" | "video"> = params.mediaTypes
        ? JSON.parse(params.mediaTypes as string)
        : {};
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
    const { taggedUsers, setTaggedUsers } = usePostComposer();

    // Compute display text based on state
    const groupDisplayText = selectedGroupId === null ? "All Friends" : (selectedGroupName || "Selected Group");

    // Auto-fill encouragers when posting about a task
    useEffect(() => {
        if (!taskInfo?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const encs = await getEncouragementsByTask(taskInfo.id);
                if (cancelled) return;
                const prefilled: TaggedUser[] = encs.map((e) => ({
                    id: e.sender?.id,
                    handle: (e.sender as any)?.handle ?? "",
                    display_name: e.sender?.name,
                })).filter((u) => u.id);
                const seen = new Set<string>();
                setTaggedUsers(prefilled.filter((u) => {
                    if (seen.has(u.id)) return false;
                    seen.add(u.id);
                    return true;
                }));
            } catch (e) {
                console.warn("failed to fetch encouragements for auto-tag", e);
            }
        })();
        return () => { cancelled = true; };
    }, [taskInfo?.id]);

    const hasActualPhotos = photos.length > 0;
    const handleCaptionChange = (text: string) => {
        setData({
            ...data,
            caption: text,
        });
    };

    const uploadMedia = async (
        uris: string[],
        typeByUri: Record<string, "image" | "video">,
        dualUri: string | null
    ): Promise<{ media: MediaItem[]; sizeInfo?: { width: number; height: number; bytes: number }; dualUrl?: string }> => {
        if (uris.length === 0) {
            return { media: [] };
        }
        const resourceId = taskInfo?.id || new ObjectId().toString();
        const media: MediaItem[] = [];

        for (let i = 0; i < uris.length; i++) {
            const uri = uris[i];
            try {
                if ((typeByUri[uri] ?? "image") === "video") {
                    media.push(await uploadVideo("post", resourceId, uri));
                } else {
                    const result = (await uploadImageSmart("post", resourceId, uri, {
                        variant: "large",
                        returnFullResult: true,
                    })) as ImageUploadResult;
                    media.push({
                        type: "image",
                        url: result.public_url,
                        width: result.width,
                        height: result.height,
                        bytes: result.size,
                    });
                }
            } catch (error) {
                console.error(`Failed to upload media ${i + 1}:`, error);
                throw new Error(`Failed to upload item ${i + 1}. Please try again.`);
            }
        }

        const first = media[0];
        const sizeInfo = first
            ? { width: first.width, height: first.height, bytes: first.bytes ?? 0 }
            : undefined;

        // Upload dual photo if it exists
        let dualUrl: string | undefined;
        if (dualUri) {
            try {
                const dualResult = (await uploadImageSmart("post", resourceId, dualUri, {
                    variant: "medium",
                    returnFullResult: true,
                })) as ImageUploadResult;
                dualUrl = dualResult.public_url;
            } catch (error) {
                console.error('Failed to upload dual photo:', error);
                // Continue without dual photo rather than failing
            }
        }

        return { media, sizeInfo, dualUrl };
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
            const uploadResult = await uploadMedia(hasActualPhotos ? photos : [], mediaTypesByUri, dualPhoto);
            const imageUrls = uploadResult.media.filter((m) => m.type === "image").map((m) => m.url);
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
                imageUrls,
                data.caption,
                taskReference,
                undefined,
                taskInfo?.public ?? false,
                uploadResult.sizeInfo,
                selectedGroups,
                uploadResult.dualUrl,
                taggedUsers.map((u) => ({ id: u.id, handle: u.handle })),
                uploadResult.media,
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

            // Replace the composer (not push on top) so "back" from the new post goes to
            // the feed, never back into the posting flow — avoids confusing re-posts.
            router.dismissAll();
            router.replace(`/(logged-in)/posting/${result.post._id}`);
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
                                    media={photos.map((uri: string) => ({
                                        type: mediaTypesByUri[uri] ?? "image",
                                        url: uri,
                                        thumbnailUrl: uri,
                                        width: 0,
                                        height: 0,
                                    }))}
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
                        <MentionTextInput
                            placeholder="Enter a caption"
                            value={data.caption}
                            setValue={handleCaptionChange}
                            fontSize={16}
                            minHeight={120}
                            onMentionPicked={(c: MentionCandidate) => {
                                setTaggedUsers((prev) => {
                                    if (prev.find((p) => p.id === c.id)) return prev;
                                    return [...prev, { id: c.id, handle: c.handle, display_name: c.display_name }];
                                });
                            }}
                        />
                        <TaggedUsersChips
                            users={taggedUsers}
                            onRemove={(id) => setTaggedUsers((prev) => prev.filter((p) => p.id !== id))}
                        />
                        <TouchableOpacity
                            style={{
                                width: "100%",
                                padding: 20,
                                justifyContent: "space-between",
                                backgroundColor: ThemedColor.lightened,
                                borderRadius: 8,
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                            onPress={() => {
                                router.push("/(logged-in)/posting/tag-people" as Href);
                            }}
                            activeOpacity={0.7}>
                            <ThemedText>Tag people</ThemedText>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <ThemedText style={{ color: ThemedColor.primary }}>
                                    {taggedUsers.length === 0
                                        ? "None"
                                        : taggedUsers.length === 1
                                            ? formatHandle(taggedUsers[0].handle)
                                            : `${taggedUsers.length} tagged`}
                                </ThemedText>
                                <Ionicons name="chevron-forward" size={16} color={ThemedColor.primary} />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                width: "100%",
                                padding: 20,
                                justifyContent: "space-between",
                                backgroundColor: ThemedColor.lightened,
                                borderRadius: 8,
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                            onPress={() => {
                                router.push("/(logged-in)/posting/groups");
                            }}
                            activeOpacity={0.7}>
                            <ThemedText>Who can see this post?</ThemedText>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <ThemedText style={{ color: ThemedColor.primary }}>{groupDisplayText}</ThemedText>
                                <Ionicons name="chevron-forward" size={16} color={ThemedColor.primary} />
                            </View>
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
