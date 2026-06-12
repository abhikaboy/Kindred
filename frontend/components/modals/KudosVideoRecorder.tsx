import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowsClockwise, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { KUDOS_VIDEO_MAX_DURATION_MS } from "@/api/upload";
import { formatVideoDuration } from "@/api/media";

interface KudosVideoRecorderProps {
    visible: boolean;
    onClose: () => void;
    /** Called with the captured clip; the parent is responsible for closing the recorder (set visible=false). */
    onRecorded: (video: { uri: string; durationMs: number }) => void;
}

/**
 * Selfie-style video kudos recorder. Front camera by default, hard-stops at
 * the kudos duration cap. The kudos modal's preview is the review step.
 */
export default function KudosVideoRecorder({ visible, onClose, onRecorded }: KudosVideoRecorderProps) {
    const insets = useSafeAreaInsets();
    const camera = useRef<CameraView>(null);
    const recordStartRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [facing, setFacing] = useState<CameraType>("front");
    const [isRecording, setIsRecording] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    const hasPermissions = cameraPermission?.granted && micPermission?.granted;

    const requestPermissions = async () => {
        const cam = await requestCameraPermission();
        const mic = await requestMicPermission();
        // Permanently denied — the system dialog won't show again, so guide to Settings.
        if ([cam, mic].some((p) => !p.granted && !p.canAskAgain)) {
            Alert.alert("Camera Access", "To record a video kudos, allow camera and microphone access in Settings.", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Open Settings",
                    onPress: () => {
                        if (Platform.OS === "ios") {
                            Linking.openURL("app-settings:");
                        } else {
                            Linking.openSettings();
                        }
                    },
                },
            ]);
        }
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Cleanup if the parent unmounts us mid-recording.
    useEffect(() => () => stopTimer(), []);

    // Parent closed us via the visible prop: stop the camera + timer, reset the pill.
    useEffect(() => {
        if (visible) return;
        camera.current?.stopRecording();
        stopTimer();
        setIsRecording(false);
        setElapsedMs(0);
    }, [visible]);

    const startRecording = async () => {
        if (!camera.current || isRecording) return;
        setIsRecording(true);
        setElapsedMs(0);
        recordStartRef.current = Date.now();
        timerRef.current = setInterval(() => {
            setElapsedMs(Date.now() - recordStartRef.current);
        }, 250);
        try {
            // Resolves when recording stops — manually or at maxDuration (seconds).
            const video = await camera.current.recordAsync({
                maxDuration: KUDOS_VIDEO_MAX_DURATION_MS / 1000,
            });
            const durationMs = Math.min(Date.now() - recordStartRef.current, KUDOS_VIDEO_MAX_DURATION_MS);
            if (video?.uri) {
                onRecorded({ uri: video.uri, durationMs });
            }
        } catch (error) {
            console.error("Error recording kudos video:", error);
        } finally {
            stopTimer();
            setIsRecording(false);
        }
    };

    const handleClose = () => {
        if (isRecording) camera.current?.stopRecording();
        stopTimer();
        setIsRecording(false);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
            <View style={styles.container}>
                {!hasPermissions ? (
                    <View style={[styles.permissionGate, { paddingTop: insets.top }]}>
                        <ThemedText type="default" style={styles.permissionText}>
                            Allow camera and microphone access to record a video kudos.
                        </ThemedText>
                        <PrimaryButton title="Grant Access" onPress={requestPermissions} />
                        <PrimaryButton ghost title="Cancel" onPress={handleClose} />
                    </View>
                ) : (
                    <>
                        <CameraView ref={camera} style={styles.camera} facing={facing} mode="video" />

                        <View style={[styles.elapsedPill, { top: insets.top + 16 }]}>
                            <ThemedText type="caption" style={styles.elapsedText}>
                                {formatVideoDuration(elapsedMs)} / {formatVideoDuration(KUDOS_VIDEO_MAX_DURATION_MS)}
                            </ThemedText>
                        </View>

                        <TouchableOpacity
                            style={[styles.closeButton, { top: insets.top + 12 }]}
                            onPress={handleClose}
                            accessibilityRole="button"
                            accessibilityLabel="Close recorder">
                            <X size={28} color="#fff" weight="bold" />
                        </TouchableOpacity>

                        <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
                            <TouchableOpacity
                                onPress={() => setFacing(facing === "front" ? "back" : "front")}
                                disabled={isRecording}
                                style={{ opacity: isRecording ? 0.4 : 1 }}
                                accessibilityRole="button"
                                accessibilityLabel="Flip camera">
                                <ArrowsClockwise size={32} color="#fff" weight="regular" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={isRecording ? () => camera.current?.stopRecording() : startRecording}
                                style={styles.recordRing}
                                accessibilityRole="button"
                                accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}>
                                <View style={isRecording ? styles.recordSquare : styles.recordCircle} />
                            </TouchableOpacity>

                            {/* spacer mirroring the flip button keeps the record button centered */}
                            <View style={{ width: 32 }} />
                        </View>
                    </>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    camera: { flex: 1 },
    permissionGate: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 },
    permissionText: { color: "#fff", textAlign: "center" },
    elapsedPill: {
        position: "absolute",
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    elapsedText: { color: "#fff", fontSize: 14 },
    closeButton: {
        position: "absolute",
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
    controls: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
    },
    recordRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    recordCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#e0245e" },
    recordSquare: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#e0245e" },
});
