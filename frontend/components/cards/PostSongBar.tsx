import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { SpeakerHigh, SpeakerSlash } from "phosphor-react-native";
import { useFeedSound, useIsActivePost } from "@/utils/feedSongPlayback";
import type { components } from "@/api/generated/types";

type Song = components["schemas"]["Song"];

// Instagram-style audio line that sits where the handle would be: a static
// icon + the song text marquee-scrolling on one line. Tap toggles feed sound.
export default function PostSongBar({ song, postId }: { song: Song; postId?: string }) {
    const ThemedColor = useThemeColor();
    const { soundOn, toggleSound } = useFeedSound();
    const isActive = useIsActivePost(postId);
    const shouldPlay = isActive && soundOn;

    return (
        <TouchableOpacity onPress={toggleSound} activeOpacity={0.6} style={styles.row}>
            {soundOn ? (
                <SpeakerHigh size={14} color={ThemedColor.primary} weight="fill" />
            ) : (
                <SpeakerSlash size={14} color={ThemedColor.caption} weight="fill" />
            )}
            <Marquee>
                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                    {song.title} · {song.artist}
                </ThemedText>
            </Marquee>
            {isActive && <SongAudio previewUrl={song.previewUrl} play={shouldPlay} />}
        </TouchableOpacity>
    );
}

function Marquee({ children }: { children: React.ReactNode }) {
    const [containerW, setContainerW] = useState(0);
    const [contentW, setContentW] = useState(0);
    const offset = useSharedValue(0);
    const GAP = 32;
    const overflow = contentW > 0 && containerW > 0 && contentW > containerW;

    useEffect(() => {
        cancelAnimation(offset);
        offset.value = 0;
        if (overflow) {
            const dist = contentW + GAP;
            offset.value = withRepeat(
                withTiming(-dist, { duration: (dist / 45) * 1000, easing: Easing.linear }),
                -1,
                false
            );
        }
        return () => cancelAnimation(offset);
    }, [overflow, contentW, offset]);

    const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

    return (
        <View style={styles.marquee} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.marqueeTrack, aStyle]}>
                <View onLayout={(e) => setContentW(e.nativeEvent.layout.width)} style={styles.marqueeCopy}>
                    {children}
                </View>
                {overflow ? <View style={[styles.marqueeCopy, { paddingLeft: GAP }]}>{children}</View> : null}
            </Animated.View>
        </View>
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
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    marquee: {
        flex: 1,
        overflow: "hidden",
    },
    marqueeTrack: {
        flexDirection: "row",
    },
    marqueeCopy: {
        flexDirection: "row",
    },
    hiddenVideo: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});
