import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { createTasksFromNaturalLanguageAPI } from "@/api/task";
import { getUserCredits, UserCredits } from "@/api/profile";
import { useTasks } from "@/contexts/tasksContext";
import { TaskGenerationLoading } from "@/components/TaskGenerationLoading";
import { TaskGenerationError } from "@/components/TaskGenerationError";
import { CreditsInfoSheet } from "@/components/CreditsInfoSheet";

type Props = {};

const VoiceDump = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { fetchWorkspaces } = useTasks();
    const [recognizing, setRecognizing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [showCreditsSheet, setShowCreditsSheet] = useState(false);

    useEffect(() => {
        // Fetch credits on mount
        const fetchCredits = async () => {
            try {
                const userCredits = await getUserCredits();
                setCredits(userCredits);
            } catch (error) {
                console.error("Failed to fetch credits:", error);
            }
        };
        fetchCredits();
    }, []);

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

    const handleGenerateTasks = async () => {
        // Clear any previous errors
        setError(null);
        
        // Validate input
        if (transcription.trim().length < 4) {
            setError("Please provide at least 4 characters of speech");
            return;
        }

        setIsLoading(true);

        try {
            const result = await createTasksFromNaturalLanguageAPI(transcription.trim());
            
            // Invalidate cache and trigger workspace refetch to get new tasks/categories
            fetchWorkspaces(true);
            
            // Refetch credits to update the count
            try {
                const updatedCredits = await getUserCredits();
                setCredits(updatedCredits);
            } catch (error) {
                console.error("Failed to refetch credits:", error);
            }
            
            // Clear the transcription
            setTranscription("");
            
            // Navigate to preview screen with the task data
            router.push({
                pathname: "/(logged-in)/(tabs)/(task)/preview" as any,
                params: {
                    tasks: JSON.stringify(result.tasks),
                    newCategories: JSON.stringify(result.newCategories || []),
                    categoriesCreated: result.categoriesCreated,
                    tasksCreated: result.tasksCreated,
                }
            });
        } catch (err) {
            // Handle different error types
            let errorMessage = "Failed to generate tasks. Please try again.";
            
            if (err instanceof Error) {
                // Extract meaningful error message
                if (err.message.includes("Failed to create tasks from natural language")) {
                    errorMessage = "AI processing failed. Please check your speech and try again.";
                } else if (err.message.includes("network") || err.message.includes("fetch")) {
                    errorMessage = "Network error. Please check your connection and try again.";
                } else {
                    errorMessage = err.message;
                }
            }
            
            setError(errorMessage);
            console.error("Error generating tasks from voice:", err);
        } finally {
            setIsLoading(false);
        }
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

                {/* Error Message */}
                {error && <TaskGenerationError message={error} />}

                {/* Loading State */}
                {isLoading && (
                    <TaskGenerationLoading 
                        message="Processing your speech with AI..." 
                        submessage="This may take a few moments"
                    />
                )}

                <View style={{ flex: 1, minHeight: 200 }} />

                {transcription && !recognizing && !isLoading && (
                    <View style={styles.generateButtonContainer}>
                        <PrimaryButton
                            title="Generate Tasks"
                            onPress={handleGenerateTasks}
                            disabled={transcription.length < 4}
                        />
                    </View>
                )}

                {/* Credits Display */}
                {credits !== null && (
                    <View style={styles.creditsContainer}>
                        <ThemedText type="caption" style={styles.creditsLabel}>
                            NATURAL LANGUAGE CREDITS
                        </ThemedText>
                        <View style={styles.creditsValue}>
                            <ThemedText type="default" style={{ fontWeight: '600' }}>
                                {credits.naturalLanguage}
                            </ThemedText>
                            <TouchableOpacity 
                                onPress={() => {
                                    console.log('Info icon pressed, opening sheet');
                                    setShowCreditsSheet(true);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons 
                                    name="information-circle-outline" 
                                    size={16} 
                                    color={ThemedColor.caption}
                                    style={{ marginLeft: 4 }}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

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

            {/* Credits Info Sheet */}
            <CreditsInfoSheet 
                visible={showCreditsSheet}
                onClose={() => {
                    console.log('Closing sheet');
                    setShowCreditsSheet(false);
                }}
                currentCredits={credits?.naturalLanguage ?? 0}
            />
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
        gap: 8,
    },
    title: {
        fontWeight: "600",
    },
    creditsContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
    },
    creditsLabel: {
        fontSize: 11,
        fontWeight: "600",
    },
    creditsValue: {
        flexDirection: "row",
        alignItems: "center",
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
    generateButtonContainer: {
        paddingVertical: 16,
        width: "100%",
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

