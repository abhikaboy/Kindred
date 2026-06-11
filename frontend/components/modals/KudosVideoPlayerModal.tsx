import React from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { X } from "phosphor-react-native";

interface KudosVideoPlayerModalProps {
    uri: string;
    onClose: () => void;
}

/**
 * Fullscreen playback for a video kudos. Deliberate viewing (unlike feed
 * autoplay): sound on, native controls. Mount only while open.
 */
export default function KudosVideoPlayerModal({ uri, onClose }: KudosVideoPlayerModalProps) {
    const insets = useSafeAreaInsets();
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
        p.play();
    });

    return (
        <Modal visible animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
                <TouchableOpacity
                    testID="kudos-video-close"
                    style={[styles.close, { top: insets.top + 12 }]}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close video">
                    <X size={28} color="#fff" weight="bold" />
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    video: { flex: 1 },
    close: {
        position: "absolute",
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
});
