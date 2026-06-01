import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

export type TaggedUser = {
    id: string;
    handle: string;
    display_name?: string;
};

type Props = {
    users: TaggedUser[];
    onRemove?: (id: string) => void; // composer mode
    onPressUser?: (id: string) => void; // read mode
};

const TaggedUsersChips = ({ users, onRemove, onPressUser }: Props) => {
    const ThemedColor = useThemeColor();
    if (users.length === 0) return null;

    const readMode = !onRemove;

    if (readMode) {
        const names = users.map((u) => u.display_name ?? u.handle);
        return (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
                <ThemedText type="caption">with </ThemedText>
                {users.map((u, i) => (
                    <TouchableOpacity key={u.id} onPress={() => onPressUser?.(u.id)} activeOpacity={0.7}>
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            {names[i]}
                            {i < users.length - 1 ? ", " : ""}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16 }}>
            {users.map((u) => (
                <View
                    key={u.id}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 16,
                        gap: 6,
                    }}>
                    <ThemedText type="caption">@{u.handle}</ThemedText>
                    <TouchableOpacity onPress={() => onRemove?.(u.id)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
};

export default TaggedUsersChips;
