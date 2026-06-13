import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MusicNote, Play, Pause, PencilSimple, X } from "phosphor-react-native";
import { type Song } from "@/api/itunes";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/api/profile";
import SongPickerModal from "./SongPickerModal";
import Equalizer from "./Equalizer";

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

function SongPreviewPill({ song, onChange, onRemove }: { song: Song; onChange: () => void; onRemove: () => void }) {
    const ThemedColor = useThemeColor();
    const [playing, setPlaying] = useState(false);
    const player = useVideoPlayer(song.previewUrl, (p) => {
        p.loop = true;
    });

    const toggle = () => {
        setPlaying((prev) => {
            const next = !prev;
            next ? player.play() : player.pause();
            return next;
        });
    };

    return (
        <View style={[styles.pill, { backgroundColor: ThemedColor.lightenedCard }]}>
            <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.pillMain}>
                <View style={[styles.artwork, { backgroundColor: ThemedColor.lightened }]}>
                    {song.artworkUrl ? (
                        <Image source={{ uri: song.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                        <MusicNote size={16} color={ThemedColor.caption} weight="fill" />
                    )}
                    <View style={styles.playOverlay}>
                        {playing ? (
                            <Pause size={14} color="#fff" weight="fill" />
                        ) : (
                            <Play size={14} color="#fff" weight="fill" />
                        )}
                    </View>
                </View>
                <View style={styles.pillText}>
                    <ThemedText type="smallerDefault" numberOfLines={1}>
                        {song.title}
                    </ThemedText>
                    <ThemedText type="caption" numberOfLines={1}>
                        {song.artist}
                    </ThemedText>
                </View>
                {playing && <Equalizer playing color={ThemedColor.primary} size={14} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={onChange} hitSlop={8} style={styles.iconBtn}>
                <PencilSimple size={16} color={ThemedColor.caption} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.iconBtn}>
                <X size={16} color={ThemedColor.caption} />
            </TouchableOpacity>
            <VideoView player={player} style={styles.hiddenVideo} />
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
    pill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        padding: 8,
        gap: 8,
    },
    pillMain: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
    },
    artwork: {
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    pillText: {
        flex: 1,
    },
    iconBtn: {
        padding: 4,
    },
    hiddenVideo: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});
