import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Vibration, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { hapticCompletionBurst } from "@/utils/haptics";

const INTRO_VIDEO_URL = "https://kindred.nyc3.cdn.digitaloceanspaces.com/output.mp4";
export const INTRO_SEEN_KEY = "hasSeenIntroVideo";

/**
 * First-launch intro video, precursor to login. Plays straight away; tap to
 * skip, and it auto-advances to login when it ends.
 */
export default function Intro() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // True once playback has actually begun, so a failed source can't count as watched
    const [started, setStarted] = useState(false);
    const finished = useRef(false);

    const player = useVideoPlayer(INTRO_VIDEO_URL, (p) => {
        p.loop = false;
        p.muted = false;
        p.play();
    });

    useEventListener(player, "playingChange", ({ isPlaying }) => {
        if (isPlaying) setStarted(true);
    });

    // Rumble for the whole playback: a rolling heartbeat of impacts on iOS,
    // a repeating vibration pattern on Android.
    useEffect(() => {
        if (!started) return;
        if (Platform.OS !== "ios") {
            // Longer on-times, shorter gaps → a heavier continuous rumble.
            Vibration.vibrate([0, 500, 120, 500, 120], true);
            return () => Vibration.cancel();
        }
        // Double-hit each beat (Heavy thud + Rigid snap ~40ms later) for a punchy rumble.
        const interval = setInterval(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}), 40);
        }, 320);
        return () => clearInterval(interval);
    }, [started]);

    const finish = () => {
        if (finished.current) return;
        finished.current = true;
        player.pause();
        hapticCompletionBurst();
        // The video is the pre-login step now.
        AsyncStorage.setItem(INTRO_SEEN_KEY, "true").catch(() => {});
        router.replace("/login");
    };

    // A failed/empty source can emit playToEnd without playing, which would burn the flag
    useEventListener(player, "playToEnd", () => {
        if (started) finish();
    });

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
            />

            <Pressable style={StyleSheet.absoluteFill} onPress={finish}>
                <View style={[styles.skipHint, { bottom: insets.bottom + 24 }]} pointerEvents="none">
                    <ThemedText type="caption" style={[styles.hintText, { opacity: 0.7 }]}>
                        Tap anywhere to skip
                    </ThemedText>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },
    skipHint: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
    },
    hintText: {
        color: "#ffffff",
    },
});
