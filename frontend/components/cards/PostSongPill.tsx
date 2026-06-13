import React, { useEffect } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MusicNote, SpeakerHigh, SpeakerSlash } from "phosphor-react-native";
import Equalizer from "@/components/profile/song/Equalizer";
import { useFeedSound, useIsActivePost } from "@/utils/feedSongPlayback";
import type { components } from "@/api/generated/types";

type Song = components["schemas"]["Song"];

export default function PostSongPill({ song, postId }: { song: Song; postId?: string }) {
    const ThemedColor = useThemeColor();
    const { soundOn, toggleSound } = useFeedSound();
    const isActive = useIsActivePost(postId);
    const shouldPlay = isActive && soundOn;

    return (
        <TouchableOpacity
            onPress={toggleSound}
            activeOpacity={0.8}
            style={[styles.pill, { backgroundColor: ThemedColor.lightenedCard }]}>
            <View style={[styles.artwork, { backgroundColor: ThemedColor.lightened }]}>
                {song.artworkUrl ? (
                    <Image source={{ uri: song.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                    <MusicNote size={16} color={ThemedColor.caption} weight="fill" />
                )}
            </View>
            <View style={styles.text}>
                <ThemedText type="smallerDefault" numberOfLines={1}>
                    {song.title}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1}>
                    {song.artist}
                </ThemedText>
            </View>
            {shouldPlay && <Equalizer playing color={ThemedColor.primary} size={14} />}
            <View style={styles.speaker}>
                {soundOn ? (
                    <SpeakerHigh size={18} color={ThemedColor.primary} weight="fill" />
                ) : (
                    <SpeakerSlash size={18} color={ThemedColor.caption} weight="fill" />
                )}
            </View>
            {/* Only the active post owns a live player — true single-active-player. */}
            {isActive && <SongAudio previewUrl={song.previewUrl} play={shouldPlay} />}
        </TouchableOpacity>
    );
}

function SongAudio({ previewUrl, play }: { previewUrl: string; play: boolean }) {
    const player = useVideoPlayer(previewUrl, (p) => {
        p.loop = true;
    });

    useEffect(() => {
        if (play) player.play();
        else player.pause();
    }, [play, player]);

    return <VideoView player={player} style={styles.hiddenVideo} />;
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        padding: 8,
        gap: 10,
        marginHorizontal: 16,
        marginTop: 8,
    },
    artwork: {
        width: 36,
        height: 36,
        borderRadius: 8,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        flex: 1,
    },
    speaker: {
        padding: 2,
    },
    hiddenVideo: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});
