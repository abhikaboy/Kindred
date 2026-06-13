import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MusicNotes, Play, Pause, PencilSimple } from "phosphor-react-native";
import { type Song } from "@/api/itunes";
import SongPickerModal from "./SongPickerModal";
import Equalizer from "./Equalizer";

// PoC persistence: local only. Real version stores this on the user via PATCH /v1/profiles/{id}.
const STORAGE_KEY = "poc:profileSong";

export default function ProfileSongWidget() {
    const ThemedColor = useThemeColor();
    const [song, setSong] = useState<Song | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((raw) => raw && setSong(JSON.parse(raw)))
            .catch(() => {});
    }, []);

    const select = (next: Song) => {
        setSong(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    };

    return (
        <View style={styles.wrapper}>
            {song ? (
                <SongPreviewPill key={song.id} song={song} onChange={() => setPickerOpen(true)} />
            ) : (
                <TouchableOpacity
                    onPress={() => setPickerOpen(true)}
                    activeOpacity={0.7}
                    style={[styles.addPill, { borderColor: ThemedColor.primary }]}>
                    <MusicNotes size={20} color={ThemedColor.primary} weight="fill" />
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        Add a song to your profile
                    </ThemedText>
                </TouchableOpacity>
            )}
            <SongPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={select} />
        </View>
    );
}

function SongPreviewPill({ song, onChange }: { song: Song; onChange: () => void }) {
    const ThemedColor = useThemeColor();
    const [playing, setPlaying] = useState(false);
    const player = useVideoPlayer(song.previewUrl, (p) => {
        p.loop = true;
    });

    useEffect(() => () => player.pause(), [player]);

    const toggle = () => {
        setPlaying((prev) => {
            const next = !prev;
            next ? player.play() : player.pause();
            return next;
        });
    };

    return (
        <View style={[styles.pill, { backgroundColor: ThemedColor.primary + "14" }]}>
            <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.pillMain}>
                <View style={[styles.playButton, { backgroundColor: ThemedColor.primary }]}>
                    {playing ? (
                        <Pause size={16} color="#fff" weight="fill" />
                    ) : (
                        <Play size={16} color="#fff" weight="fill" />
                    )}
                </View>
                <Equalizer playing={playing} color={ThemedColor.primary} size={16} />
                <View style={styles.pillText}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {song.title}
                    </ThemedText>
                    <ThemedText type="smallerDefault" numberOfLines={1} style={{ color: ThemedColor.primary }}>
                        {song.artist}
                    </ThemedText>
                </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onChange} hitSlop={10} style={styles.changeBtn}>
                <PencilSimple size={18} color={ThemedColor.primary} />
            </TouchableOpacity>
            <VideoView player={player} style={styles.hiddenVideo} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
    },
    addPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 10,
    },
    pillMain: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
    },
    playButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    pillText: {
        flex: 1,
    },
    changeBtn: {
        padding: 4,
    },
    hiddenVideo: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});
