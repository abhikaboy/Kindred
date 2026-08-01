import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { PencilSimple } from "phosphor-react-native";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PostTaskPickerBottomSheet from "../modals/PostTaskPickerBottomSheet";

export default function ComposePostCard() {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const [pickerVisible, setPickerVisible] = useState(false);

    return (
        <>
            <TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => setPickerVisible(true)}>
                {user?.profile_picture ? (
                    <CachedImage source={{ uri: user.profile_picture }} style={styles.avatar} variant="thumbnail" cachePolicy="memory-disk" />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: ThemedColor.lightened }]} />
                )}
                <ThemedText type="lightBody" style={[styles.placeholder, { color: ThemedColor.caption }]}>
                    Watchu been working on recently?
                </ThemedText>
                <PencilSimple size={18} color={ThemedColor.caption} weight="regular" />
            </TouchableOpacity>
            <PostTaskPickerBottomSheet visible={pickerVisible} setVisible={setPickerVisible} />
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    placeholder: {
        flex: 1,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
});
