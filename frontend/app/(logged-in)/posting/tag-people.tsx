import React, { useState, useMemo } from "react";
import { View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MentionCandidate } from "@/hooks/useFriendsForMention";
import { usePostComposer } from "@/contexts/PostComposerContext";
import { Ionicons } from "@expo/vector-icons";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";
import FriendPicker from "@/components/inputs/FriendPicker";

export default function TagPeople() {
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const { taggedUsers, setTaggedUsers } = usePostComposer();
    const [selected, setSelected] = useState<Map<string, TaggedUser>>(
        () => new Map(taggedUsers.map((u) => [u.id, u])),
    );

    const toggle = (c: MentionCandidate) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(c.id)) next.delete(c.id);
            else next.set(c.id, { id: c.id, handle: c.handle, display_name: c.display_name });
            return next;
        });
    };

    const done = () => {
        setTaggedUsers(Array.from(selected.values()));
        router.back();
    };

    const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

    return (
        <ThemedView style={{ flex: 1, paddingTop: insets.top }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="arrow-back" size={22} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={{ marginLeft: 12, flex: 1 }}>Tag people</ThemedText>
                <TouchableOpacity onPress={done}>
                    <ThemedText style={{ color: ThemedColor.primary }}>Done</ThemedText>
                </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginHorizontal: 16 }}>
                <FriendPicker selectedIds={selectedIds} onToggle={toggle} />
            </View>
        </ThemedView>
    );
}
