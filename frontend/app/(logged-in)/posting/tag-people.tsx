import React, { useState, useMemo } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";
import { usePostComposer } from "@/contexts/PostComposerContext";
import { Ionicons } from "@expo/vector-icons";
import ThemedInput from "@/components/inputs/ThemedInput";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";

export default function TagPeople() {
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const { taggedUsers, setTaggedUsers } = usePostComposer();
    const [selected, setSelected] = useState<Map<string, TaggedUser>>(
        () => new Map(taggedUsers.map((u) => [u.id, u])),
    );
    const [query, setQuery] = useState("");
    const { filter } = useFriendsForMention();
    const matches = useMemo(() => filter(query), [query, filter]);

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
            <View style={{ marginHorizontal: 16 }}>
                <ThemedInput
                    value={query}
                    setValue={setQuery}
                    placeHolder="Search friends"
                />
            </View>
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const checked = selected.has(item.id);
                    return (
                        <FriendRow
                            item={item}
                            checked={checked}
                            onToggle={toggle}
                            primaryColor={ThemedColor.primary}
                            captionColor={ThemedColor.caption}
                        />
                    );
                }}
            />
        </ThemedView>
    );
}

type FriendRowProps = {
    item: MentionCandidate;
    checked: boolean;
    onToggle: (c: MentionCandidate) => void;
    primaryColor: string;
    captionColor: string;
};

function FriendRow({ item, checked, onToggle, primaryColor, captionColor }: FriendRowProps) {
    return (
        <TouchableOpacity
            onPress={() => onToggle(item)}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, gap: 12 }}>
            <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{item.display_name}</ThemedText>
                <ThemedText type="caption">@{item.handle}</ThemedText>
            </View>
            <Ionicons
                name={checked ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={checked ? primaryColor : captionColor}
            />
        </TouchableOpacity>
    );
}
