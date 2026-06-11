import React, { useMemo, useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";
import { Ionicons } from "@expo/vector-icons";
import { formatHandle } from "@/utils/handle";

type Props = {
    selectedIds: Set<string>;
    onToggle: (candidate: MentionCandidate) => void;
    /** Friend IDs that can't be toggled (e.g. tags already responded to). */
    lockedIds?: Set<string>;
};

const FriendPicker = ({ selectedIds, onToggle, lockedIds }: Props) => {
    const ThemedColor = useThemeColor();
    const [query, setQuery] = useState("");
    const { filter } = useFriendsForMention();
    const matches = useMemo(() => filter(query), [query, filter]);

    return (
        <View style={{ flex: 1, gap: 12 }}>
            <ThemedInput value={query} setValue={setQuery} placeHolder="Search friends" />
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <FriendRow
                        item={item}
                        checked={selectedIds.has(item.id)}
                        locked={lockedIds?.has(item.id) ?? false}
                        onToggle={onToggle}
                        primaryColor={ThemedColor.primary}
                        captionColor={ThemedColor.caption}
                    />
                )}
            />
        </View>
    );
};

type FriendRowProps = {
    item: MentionCandidate;
    checked: boolean;
    locked: boolean;
    onToggle: (c: MentionCandidate) => void;
    primaryColor: string;
    captionColor: string;
};

function FriendRow({ item, checked, locked, onToggle, primaryColor, captionColor }: FriendRowProps) {
    return (
        <TouchableOpacity
            disabled={locked}
            onPress={() => onToggle(item)}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12, opacity: locked ? 0.5 : 1 }}>
            <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{item.display_name}</ThemedText>
                <ThemedText type="caption">{formatHandle(item.handle)}</ThemedText>
            </View>
            <Ionicons
                name={checked ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={checked ? primaryColor : captionColor}
            />
        </TouchableOpacity>
    );
}

export default FriendPicker;
