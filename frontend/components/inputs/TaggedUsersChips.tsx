import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { formatHandle } from "@/utils/handle";
import CachedImage from "@/components/CachedImage";

export type TaggedUser = {
    id: string;
    handle: string;
    display_name?: string;
    profile_picture?: string;
};

const AVATAR = 18;

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
                        paddingLeft: 6,
                        paddingRight: 10,
                        paddingVertical: 6,
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 16,
                        gap: 6,
                    }}>
                    {u.profile_picture ? (
                        <CachedImage
                            source={{ uri: u.profile_picture }}
                            style={styles.avatar}
                            variant="thumbnail"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: ThemedColor.tertiary }]} />
                    )}
                    <ThemedText type="caption">{formatHandle(u.handle)}</ThemedText>
                    <TouchableOpacity onPress={() => onRemove(u.id)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
    },
});

export default TaggedUsersChips;
