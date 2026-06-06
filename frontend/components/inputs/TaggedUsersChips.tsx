import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { formatHandle } from "@/utils/handle";

export type TaggedUser = {
    id: string;
    handle: string;
    display_name?: string;
};

type Props = {
    users: TaggedUser[];
    onRemove: (id: string) => void;
};

const TaggedUsersChips = ({ users, onRemove }: Props) => {
    const ThemedColor = useThemeColor();
    if (users.length === 0) return null;

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
                    <ThemedText type="caption">{formatHandle(u.handle)}</ThemedText>
                    <TouchableOpacity onPress={() => onRemove(u.id)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
};

export default TaggedUsersChips;
