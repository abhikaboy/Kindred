import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MusicNote, Play, Pause, PencilSimple, X } from "phosphor-react-native";
import { type Song } from "@/api/itunes";
import Equalizer from "./Equalizer";

// Tappable song pill with a 30s preview. Edit/remove controls only render when
// their handlers are passed, so the same pill serves the editable own-profile
// widget and the read-only display on other users' profiles.
export default function SongPreviewPill({
    song,
    onChange,
    onRemove,
}: {
    song: Song;
    onChange?: () => void;
    onRemove?: () => void;
}) {
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
            {onChange && (
                <TouchableOpacity onPress={onChange} hitSlop={8} style={styles.iconBtn}>
                    <PencilSimple size={16} color={ThemedColor.caption} />
                </TouchableOpacity>
            )}
            {onRemove && (
                <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.iconBtn}>
                    <X size={16} color={ThemedColor.caption} />
                </TouchableOpacity>
            )}
            <VideoView player={player} style={styles.hiddenVideo} />
        </View>
    );
}

const styles = StyleSheet.create({
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
