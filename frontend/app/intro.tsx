import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { PlayIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { hapticLight } from "@/utils/haptics";

const INTRO_VIDEO_URL = "https://kindred.nyc3.cdn.digitaloceanspaces.com/output.mp4";
export const INTRO_SEEN_KEY = "hasSeenIntroVideo";

/**
 * First-launch intro video, precursor to login. Tap to start (so audio is
 * user-initiated), tap again to skip; auto-advances to login when it ends.
 */
export default function Intro() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [started, setStarted] = useState(false);
    const finished = useRef(false);

    const player = useVideoPlayer(INTRO_VIDEO_URL, (p) => {
        p.loop = false;
        p.muted = false;
    });

    const finish = () => {
        if (finished.current) return;
        finished.current = true;
        player.pause();
        // The video replaces the old intro screens as the pre-login step, so
        // mark both flags — otherwise a later open falls back into the old flow.
        AsyncStorage.multiSet([
            [INTRO_SEEN_KEY, "true"],
            ["hasSeenOnboarding", "true"],
        ]).catch(() => {});
        router.replace("/login");
    };

    useEventListener(player, "playToEnd", finish);

    const handleTap = () => {
        if (!started) {
            hapticLight();
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
                        <View style={styles.playBadge}>
                            <PlayIcon size={36} color="#ffffff" weight="duotone" />
                        </View>
                        <ThemedText type="defaultSemiBold" style={styles.hintText}>
                            Tap to begin
                        </ThemedText>
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
        gap: 16,
    },
    playBadge: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
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
