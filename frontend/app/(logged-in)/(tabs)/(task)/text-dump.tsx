import { Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { createTasksFromNaturalLanguageAPI } from "@/api/task";

type Props = {};

const TextDump = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateTasks = async () => {
        // Clear any previous errors
        setError(null);
        
        // Validate input
        if (text.trim().length < 4) {
            setError("Please enter at least 4 characters");
            return;
        }

        setIsLoading(true);

        try {
            const result = await createTasksFromNaturalLanguageAPI(text.trim());
            
            // Clear the text input
            setText("");
            
            // Navigate to preview screen with the task data
            router.push({
                pathname: "/(logged-in)/(tabs)/(task)/preview" as any,
                params: {
                    tasks: JSON.stringify(result.tasks),
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
                    errorMessage = "AI processing failed. Please check your text and try again.";
                } else if (err.message.includes("network") || err.message.includes("fetch")) {
                    errorMessage = "Network error. Please check your connection and try again.";
                } else {
                    errorMessage = err.message;
                }
            }
            
            setError(errorMessage);
            console.error("Error generating tasks:", err);
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
                        Text Dump
                    </ThemedText>
                    <ThemedText 
                        type="default" 
                        style={[styles.subtitle, { color: ThemedColor.caption }]}>
                        Write down your thoughts freely
                    </ThemedText>
                </View>

                {/* Text Input Section */}
                <View style={styles.textInputSection}>
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                color: ThemedColor.text,
                                backgroundColor: ThemedColor.background,
                                borderColor: ThemedColor.tertiary,
                            }
                        ]}
                        multiline
                        placeholder="Start typing here..."
                        placeholderTextColor={ThemedColor.caption}
                        value={text}
                        onChangeText={setText}
                        autoFocus={false}
                        textAlignVertical="top"
                    />
                </View>

                {/* Character Count */}
                {text.length > 0 && (
                    <View style={styles.characterCountSection}>
                        <ThemedText 
                            type="default" 
                            style={[styles.characterCount, { color: ThemedColor.caption }]}>
                            {text.length} character{text.length !== 1 ? 's' : ''}
                        </ThemedText>
                    </View>
                )}

                {/* Error Message */}
                {error && (
                    <View style={[styles.errorContainer, { backgroundColor: ThemedColor.tertiary }]}>
                        <Ionicons name="alert-circle" size={20} color="#ef4444" style={styles.errorIcon} />
                        <ThemedText style={styles.errorText}>
                            {error}
                        </ThemedText>
                    </View>
                )}

                {/* Loading State */}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={ThemedColor.tint} />
                        <ThemedText 
                            type="default" 
                            style={[styles.loadingText, { color: ThemedColor.caption }]}>
                            Processing your text with AI...
                        </ThemedText>
                        <ThemedText 
                            type="default" 
                            style={[styles.loadingSubtext, { color: ThemedColor.caption }]}>
                            This may take a few moments
                        </ThemedText>
                    </View>
                )}

                {/* Generate Tasks Button */}
                <View style={styles.generateButtonContainer}>
                    <PrimaryButton
                        title={isLoading ? "Generating..." : "Generate Tasks"}
                        onPress={handleGenerateTasks}
                        disabled={text.length < 4 || isLoading}
                    />
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default TextDump;

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
        paddingBottom: 24,
        paddingTop: 4,
        gap: 8,
    },
    title: {
        fontWeight: "600",
    },
    subtitle: {
        fontSize: 14,
    },
    textInputSection: {
        marginBottom: 16,
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 200,
        fontFamily: "Outfit",
    },
    characterCountSection: {
        alignItems: "flex-end",
        paddingHorizontal: 4,
    },
    characterCount: {
        fontSize: 12,
    },
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        marginVertical: 12,
        gap: 8,
    },
    errorIcon: {
        flexShrink: 0,
    },
    errorText: {
        fontSize: 14,
        flex: 1,
        color: "#ef4444",
    },
    loadingContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: "500",
    },
    loadingSubtext: {
        fontSize: 14,
    },
    generateButtonContainer: {
        paddingVertical: 16,
        width: "100%",
    },
});

