import React, { useMemo, useState, useEffect } from "react";
import { Modal, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import FriendPicker from "@/components/inputs/FriendPicker";
import { updateTaskTagsAPI } from "@/api/task";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";
import type { Task } from "@/api/types";

type Props = {
    visible: boolean;
    onClose: () => void;
    task: Task;
    onTagsUpdated: (taggedUsers: Task["taggedUsers"]) => void;
};

const TagFriendsModal = ({ visible, onClose, task, onTagsUpdated }: Props) => {
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();

    // Responded entries are locked: removal-after-response is out of scope
    const lockedIds = useMemo(
        () => new Set((task.taggedUsers ?? []).filter((t) => t.status !== "pending").map((t) => t.id)),
        [task.taggedUsers]
    );

    const [selected, setSelected] = useState<Set<string>>(
        () => new Set((task.taggedUsers ?? []).filter((t) => t.status !== "untagged").map((t) => t.id))
    );

    // Reset selection whenever the modal is opened so cancel-then-reopen shows fresh state
    useEffect(() => {
        if (visible) {
            setSelected(new Set((task.taggedUsers ?? []).filter((t) => t.status !== "untagged").map((t) => t.id)));
        }
    }, [visible]);

    const toggle = (c: MentionCandidate) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(c.id)) next.delete(c.id);
            else next.add(c.id);
            return next;
        });
    };

    const save = async () => {
        try {
            const result = await updateTaskTagsAPI(task.categoryID!, task.id, Array.from(selected));
            onTagsUpdated(result.taggedUsers);
        } catch (error) {
            console.error("Failed to update tags:", error);
        }
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <ThemedView style={{ flex: 1, paddingTop: insets.top, paddingHorizontal: 16, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <ThemedText style={{ color: ThemedColor.caption }}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={{ flex: 1, textAlign: "center" }}>Tag friends</ThemedText>
                    <TouchableOpacity onPress={save} hitSlop={8}>
                        <ThemedText style={{ color: ThemedColor.primary }}>Done</ThemedText>
                    </TouchableOpacity>
                </View>
                <FriendPicker selectedIds={selected} onToggle={toggle} lockedIds={lockedIds} />
            </ThemedView>
        </Modal>
    );
};

export default TagFriendsModal;
