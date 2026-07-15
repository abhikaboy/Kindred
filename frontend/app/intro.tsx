import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Vibration, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import * as Haptics from "expo-haptics";
import { PlayIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { hapticCompletionBurst, hapticHeavy } from "@/utils/haptics";

const INTRO_VIDEO_URL = "https://kindred.nyc3.cdn.digitaloceanspaces.com/output.mp4";
export const INTRO_SEEN_KEY = "hasSeenIntroVideo";
const PRIMARY = "#854DFF";

/**
 * First-launch intro video, precursor to login. Tap to start (so audio is
 * user-initiated), tap again to skip; auto-advances to login when it ends.
 */
export default function Intro() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [started, setStarted] = useState(false);
    const finished = useRef(false);
    const pulse = useRef(new Animated.Value(0)).current;

    // Breathing halo behind the play button until the user starts.
    useEffect(() => {
        if (started) return;
        const loop = Animated.loop(
            Animated.timing(pulse, {
                toValue: 1,
                duration: 1600,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [started, pulse]);

    const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
    const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

    const player = useVideoPlayer(INTRO_VIDEO_URL, (p) => {
        p.loop = false;
        p.muted = false;
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

    // Only a real watched-to-the-end counts — a failed/empty source can emit
    // playToEnd before the user ever taps play, which would burn the flag.
    useEventListener(player, "playToEnd", () => {
        if (started) finish();
    });

    const handleTap = () => {
        if (!started) {
            hapticHeavy();
            setStarted(true);
            player.play();
        } else {
            finish();
        }
    };

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
            />

            <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
                {!started ? (
                    <View style={styles.startOverlay} pointerEvents="none">
                        <View style={styles.playStack}>
                            <Animated.View
                                style={[
                                    styles.halo,
                                    { opacity: haloOpacity, transform: [{ scale: haloScale }] },
                                ]}
                            />
                            <View style={styles.playBadge}>
                                <PlayIcon size={34} color="#ffffff" weight="fill" style={{ marginLeft: 4 }} />
                            </View>
                        </View>
                        <ThemedText style={styles.startLabel}>TAP TO BEGIN</ThemedText>
                    </View>
                ) : (
                    <View style={[styles.skipHint, { bottom: insets.bottom + 24 }]} pointerEvents="none">
                        <ThemedText type="caption" style={[styles.hintText, { opacity: 0.7 }]}>
                            Tap anywhere to skip
                        </ThemedText>
                    </View>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },
    startOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
    },
    playStack: {
        width: 92,
        height: 92,
        alignItems: "center",
        justifyContent: "center",
    },
    halo: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 46,
        backgroundColor: PRIMARY,
    },
    playBadge: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: PRIMARY,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.9)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: PRIMARY,
        shadowOpacity: 0.6,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
    startLabel: {
        color: "#ffffff",
        fontSize: 13,
        fontFamily: "Outfit",
        fontWeight: "600",
        letterSpacing: 3,
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
