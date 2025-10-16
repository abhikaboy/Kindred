import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "expo-speech-recognition";

type Props = {};

const VoiceDump = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const [recognizing, setRecognizing] = useState(false);
    const [transcription, setTranscription] = useState("");

    // Speech recognition event handlers
    useSpeechRecognitionEvent("start", () => {
        console.log("Speech recognition started");
        setRecognizing(true);
    });

    useSpeechRecognitionEvent("end", () => {
        console.log("Speech recognition ended");
        setRecognizing(false);
    });

    useSpeechRecognitionEvent("result", (event) => {
        console.log("Speech recognition result:", event);
        const newTranscript = event.results[0]?.transcript;
        if (newTranscript) {
            setTranscription(newTranscript);
        }
    });

    useSpeechRecognitionEvent("error", (event) => {
        console.error("Speech recognition error:", event.error, event.message);
        setRecognizing(false);
    });

    const handleMicrophonePress = async () => {
        if (recognizing) {
            // Stop recording
            ExpoSpeechRecognitionModule.stop();
            return;
        }

        // Request permissions
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
            console.warn("Permissions not granted", result);
            return;
        }

        // Start speech recognition
        ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: false,
            maxAlternatives: 1,
            recordingOptions: {
                persist: false,
            },
        });
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.container}>
                {/* Back Button */}
                <TouchableOpacity 
                    onPress={() => router.back()}
                    style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                        Voice Dump
                    </ThemedText>
                </View>

                {/* Preview Section */}
                <View style={styles.previewSection}>
                    <ThemedText type="subtitle" style={styles.previewLabel}>
                        Preview
                    </ThemedText>
                    {transcription ? (
                        <ThemedText type="default" style={styles.transcriptionText}>
                            {transcription}
                        </ThemedText>
                    ) : (
                        <ThemedText 
                            type="default" 
                            style={[styles.transcriptionText, { color: ThemedColor.caption, fontStyle: "italic" }]}>
                            Your transcription will appear here...
                        </ThemedText>
                    )}
                </View>

                {/* Spacer to push microphone to bottom */}
                <View style={{ flex: 1, minHeight: 200 }} />

                {/* Microphone Button Section */}
                <View style={styles.microphoneSection}>
                    <ThemedText 
                        type="default" 
                        style={[styles.tapToSpeakText, { color: ThemedColor.caption }]}>
                        {recognizing ? "Listening..." : "Tap to Speak"}
                    </ThemedText>
                    <TouchableOpacity
                        onPress={handleMicrophonePress}
                        activeOpacity={0.8}
                        style={[
                            styles.microphoneButton,
                            { 
                                backgroundColor: recognizing ? ThemedColor.error : ThemedColor.primary,
                                transform: recognizing ? [{ scale: 1.1 }] : [{ scale: 1 }],
                            }
                        ]}>
                        <Ionicons 
                            name={recognizing ? "stop" : "mic"} 
                            size={32} 
                            color="#ffffff" 
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default VoiceDump;

const styles = StyleSheet.create({
    container: {
        paddingTop: Dimensions.get("screen").height * 0.07,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 120, // Extra padding for tab bar
    },
    backButton: {
        marginBottom: 16,
    },
    headerContainer: {
        paddingBottom: 32,
        paddingTop: 4,
    },
    title: {
        fontWeight: "600",
    },
    previewSection: {
        gap: 16,
        marginBottom: 24,
    },
    previewLabel: {
        fontWeight: "400",
    },
    transcriptionText: {
        lineHeight: 24,
    },
    microphoneSection: {
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        paddingVertical: 24,
    },
    tapToSpeakText: {
        fontSize: 16,
    },
    microphoneButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
});

