import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { PencilSimple } from "phosphor-react-native";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import PostTaskPickerBottomSheet from "../modals/PostTaskPickerBottomSheet";

export default function ComposePostCard() {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const [pickerVisible, setPickerVisible] = useState(false);
    const isDark = useColorScheme() === "dark";

    return (
        <>
            <View style={styles.wrap}>
            {/* Same raised pill as the home quick-add: rounded, shadow instead of a border */}
            <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.card, { backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background }]}
                onPress={() => setPickerVisible(true)}>
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
            </View>
            <PostTaskPickerBottomSheet visible={pickerVisible} setVisible={setPickerVisible} />
        </>
    );
}

const styles = StyleSheet.create({
    // Room around the pill so its shadow isn't clipped by the list header
    wrap: {
        // Full width, less 4px a side
        paddingHorizontal: 4,
        paddingTop: 6,
        paddingBottom: 10,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 58,
        borderRadius: 100,
        paddingLeft: 10,
        paddingRight: 18,
        paddingVertical: 8,
        shadowColor: "#000",
        // A light lift, not a halo
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
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
