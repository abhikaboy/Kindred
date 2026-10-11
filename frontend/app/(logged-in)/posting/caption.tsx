import React, { useRef, useState, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import MentionTextInput from "@/components/inputs/MentionTextInput";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";
import PropertyChip from "@/components/modals/create/composer/PropertyChip";
import { STAGE } from "@/components/capture/CaptureStage";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
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
import StageMedia from "@/components/posting/StageMedia";
import { usePostComposer } from "@/contexts/PostComposerContext";
import SongPickerModal from "@/components/profile/song/SongPickerModal";
import { ArrowLeft, At, MusicNote, UsersThree } from "phosphor-react-native";
import { getEncouragementsByTask } from "@/api/encouragement";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";
import type { Href } from "expo-router";
import { usePostingLesson } from "@/contexts/PostingLessonContext";
import { useIsGuest } from "@/hooks/useIsGuest";
import { openAccountOverlay } from "@/hooks/useAccountOverlay";
import { registerCoachAnchor } from "@/utils/onboardingV2/coachAnchors";

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
    const [songPickerOpen, setSongPickerOpen] = useState(false);
    const taskInfo = params.taskInfo ? JSON.parse(params.taskInfo as string) : null;

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const { updateUser } = useAuth();
    const [keyboardUp, setKeyboardUp] = useState(false);
    useEffect(() => {
        const ios = Platform.OS === "ios";
        const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardUp(true));
        const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardUp(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    // The posting lesson points at the caption box and the Post button
    const lesson = usePostingLesson();
    const isGuest = useIsGuest();
    const captionAnchorRef = useRef<View>(null);
    const postAnchorRef = useRef<View>(null);
    useEffect(() => registerCoachAnchor("postCaption", captionAnchorRef), []);
    useEffect(() => registerCoachAnchor("postButton", postAnchorRef), []);
    // Reaching this screen means the photo step is done, however they got here (photo, library or skip)
    useEffect(() => {
        lesson.advance("caption");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { capture } = useAnalytics();
    const { showRingUpdate } = useRingUpdate();
    const { selectedGroupId, selectedGroupName, getGroupIds } = useSelectedGroup();
    const { taggedUsers, setTaggedUsers, song, setSong } = usePostComposer();

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
                    profile_picture: e.sender?.picture,
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
        // A guest can't post: the lesson ends with the account prompt instead of a post
        if (isGuest && lesson.step) {
            lesson.finish();
            openAccountOverlay("social", { surface: "feed" });
            return;
        }
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
                      status: (taskInfo.status as "completed" | "in_progress") || "completed",
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
                song ?? undefined,
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

            lesson.finish();

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

    const tagLabel =
        taggedUsers.length === 0
            ? "Tag people"
            : taggedUsers.length === 1
                ? formatHandle(taggedUsers[0].handle)
                : `${taggedUsers.length} tagged`;
    const taskMeta = taskInfo
        ? [taskInfo.categoryName, taskInfo.status === "in_progress" ? "In progress" : "Completed"]
              .filter(Boolean)
              .join(" · ")
        : null;

    return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled">
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: STAGE.fill,
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                            <ArrowLeft size={20} color={STAGE.text} />
                        </TouchableOpacity>

                        {/* The task is the headline: it's what this post is about */}
                        <View style={{ marginTop: 24, gap: 4 }}>
                            <ThemedText type="fancyFrauncesSubheading" style={{ color: STAGE.text }} numberOfLines={3}>
                                {taskInfo?.name || "New post"}
                            </ThemedText>
                            {taskMeta && (
                                <ThemedText type="caption" style={{ color: STAGE.muted }}>
                                    {taskMeta}
                                </ThemedText>
                            )}
                        </View>

                        <View ref={captionAnchorRef} collapsable={false} style={{ marginTop: 24 }}>
                            <MentionTextInput
                                placeholder="Say something about it"
                                value={data.caption}
                                setValue={handleCaptionChange}
                                fontSize={17}
                                minHeight={48}
                                color={STAGE.text}
                                placeholderColor={STAGE.faint}
                                // The lesson's coach marks need the screen, not the keyboard
                                autoFocus={!lesson.step}
                                onMentionPicked={(c: MentionCandidate) => {
                                    setTaggedUsers((prev) => {
                                        if (prev.find((p) => p.id === c.id)) return prev;
                                        return [...prev, { id: c.id, handle: c.handle, display_name: c.display_name, profile_picture: c.profile_picture }];
                                    });
                                }}
                            />
                        </View>
                    </View>

                    {/* Same rounded box as the camera, so the photo reads as carried over */}
                    {hasActualPhotos && (
                        <View style={{ marginTop: 16, marginHorizontal: 12 }}>
                            <StageMedia uris={photos} mediaTypesByUri={mediaTypesByUri} dual={dualPhoto} />
                        </View>
                    )}
                </ScrollView>

                <View
                    style={{
                        paddingHorizontal: HORIZONTAL_PADDING,
                        paddingTop: 12,
                        paddingBottom: keyboardUp ? 12 : insets.bottom + 12,
                        gap: 12,
                    }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <PropertyChip
                            Icon={UsersThree}
                            state="set"
                            tier="core"
                            label={groupDisplayText}
                            onPress={() => router.push("/(logged-in)/posting/groups")}
                            accessibilityLabel="Who can see this post"
                        />
                        <PropertyChip
                            Icon={At}
                            state={taggedUsers.length > 0 ? "set" : "empty"}
                            tier="core"
                            label={tagLabel}
                            onPress={() => router.push("/(logged-in)/posting/tag-people" as Href)}
                            onClear={() => setTaggedUsers([])}
                            accessibilityLabel="Tagged people"
                        />
                        <PropertyChip
                            Icon={MusicNote}
                            state={song ? "set" : "empty"}
                            tier="core"
                            label={song ? song.title : "Music"}
                            onPress={() => setSongPickerOpen(true)}
                            onClear={() => setSong(null)}
                            accessibilityLabel="Music"
                        />
                    </View>
                    <View ref={postAnchorRef} collapsable={false}>
                        <PrimaryButton
                            title={isPosting ? "Posting..." : "Post"}
                            onPress={handlePost}
                            disabled={isPosting}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
            <SongPickerModal
                visible={songPickerOpen}
                onClose={() => setSongPickerOpen(false)}
                onSelect={(s) => setSong(s)}
            />
            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
        </View>
    );
}
