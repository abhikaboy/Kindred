import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MusicNote } from "phosphor-react-native";
import { type Song } from "@/api/itunes";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/api/profile";
import SongPickerModal from "./SongPickerModal";
import SongPreviewPill from "./SongPreviewPill";

export default function ProfileSongWidget() {
    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const [pickerOpen, setPickerOpen] = useState(false);
    const song = user?.song ?? null;

    const select = (next: Song) => {
        if (!user?._id) return;
        updateUser({ song: next }); // optimistic local update
        updateProfile(user._id, { song: next }).catch(() => {});
    };

    // Clears locally; persisting the clear needs a PATCH $unset (song uses omitempty).
    const remove = () => {
        updateUser({ song: undefined });
    };

    return (
        <View style={styles.wrapper}>
            {song ? (
                <SongPreviewPill key={song.id} song={song} onChange={() => setPickerOpen(true)} onRemove={remove} />
            ) : (
                <TouchableOpacity onPress={() => setPickerOpen(true)} activeOpacity={0.6} style={styles.addRow}>
                    <MusicNote size={15} color={ThemedColor.caption} weight="fill" />
                    <ThemedText type="caption">Add music to your profile</ThemedText>
                </TouchableOpacity>
            )}
            <SongPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={select} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginTop: -14,
    },
    addRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
    },
});
