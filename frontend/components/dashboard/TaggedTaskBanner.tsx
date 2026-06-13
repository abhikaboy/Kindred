import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useCreateModal } from "@/contexts/createModalContext";
import { Screen } from "@/components/modals/CreateModal";
import { respondToTaskTagAPI } from "@/api/task";
import { usePendingTaskTags, PENDING_TAGS_KEY } from "@/hooks/usePendingTaskTags";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import CachedImage from "@/components/CachedImage";
import type { PendingTaggedTask } from "@/api/types";

export const TaggedTaskBanners = () => {
    const { data } = usePendingTaskTags();
    if (!data || data.length === 0) return null;
    return (
        <View style={{ gap: 4, marginHorizontal: HORIZONTAL_PADDING }}>
            {data.map((tag) => (
                <TaggedTaskBannerRow key={tag.taskId} tag={tag} />
            ))}
        </View>
    );
};

const AVATAR_SIZE = 32;

const TaggedTaskBannerRow = ({ tag }: { tag: PendingTaggedTask }) => {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const { loadTaskData, setCopySourceTaskId } = useTaskCreation();
    const { openModal } = useCreateModal();

    const respond = useMutation({
        mutationFn: (status: "watching" | "untagged") => respondToTaskTagAPI(tag.taskId, status),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: PENDING_TAGS_KEY });
            const prev = queryClient.getQueryData<PendingTaggedTask[]>(PENDING_TAGS_KEY);
            queryClient.setQueryData<PendingTaggedTask[]>(PENDING_TAGS_KEY, (old) =>
                (old ?? []).filter((t) => t.taskId !== tag.taskId)
            );
            return { prev };
        },
        onError: (_err, _status, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(PENDING_TAGS_KEY, ctx.prev);
        },
    });

    // Copy opens the create flow on the workspace picker so the user chooses a
    // destination before the category-scoped Standard sheet.
    const handleCopy = () => {
        setCopySourceTaskId(tag.taskId);
        loadTaskData({
            content: tag.content,
            value: tag.value,
            priority: tag.priority,
            recurring: tag.recurring,
            recurFrequency: tag.recurFrequency,
            recurDetails: tag.recurDetails,
            deadline: tag.deadline,
            notes: tag.notes,
            checklist: tag.checklist,
        });
        openModal({ screen: Screen.SELECT_WORKSPACE });
    };

    return (
        <View style={{ borderLeftWidth: 2, borderLeftColor: ThemedColor.primary, paddingLeft: 12, paddingTop: 6, paddingBottom: 6, gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {tag.tagger.profile_picture ? (
                    <CachedImage
                        source={{ uri: tag.tagger.profile_picture }}
                        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: ThemedColor.primary + "33" }} />
                )}
                <View style={{ flex: 1 }}>
                    <ThemedText type="default">
                        <ThemedText type="defaultSemiBold">{tag.tagger.display_name}</ThemedText> tagged you in a task
                    </ThemedText>
                    <ThemedText type="caption">
                        {tag.content} · {tag.value} pts
                    </ThemedText>
                </View>
            </View>
            <View style={{ flexDirection: "row", gap: 24 }}>
                <TouchableOpacity onPress={() => respond.mutate("watching")} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>Watch</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCopy} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.caption }}>Copy</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => respond.mutate("untagged")} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.caption, opacity: 0.6 }}>Untag me</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};
