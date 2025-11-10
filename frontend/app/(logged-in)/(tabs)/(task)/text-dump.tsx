import { Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { createTasksFromNaturalLanguageAPI } from "@/api/task";
import { getUserCredits, UserCredits } from "@/api/profile";
import { useTasks } from "@/contexts/tasksContext";
import { TaskGenerationLoading } from "@/components/TaskGenerationLoading";
import { TaskGenerationError } from "@/components/TaskGenerationError";
import { CreditsInfoSheet } from "@/components/CreditsInfoSheet";

type Props = {};

const TextDump = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { fetchWorkspaces } = useTasks();
    const [text, setText] = useState("");
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
            
            // Invalidate cache and trigger workspace refetch to get new tasks/categories
            fetchWorkspaces(true);
            
            // Refetch credits to update the count
            try {
                const updatedCredits = await getUserCredits();
                setCredits(updatedCredits);
            } catch (error) {
                console.error("Failed to refetch credits:", error);
            }
            
            // Clear the text input
            setText("");
            
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
                {error && <TaskGenerationError message={error} />}

                {/* Loading State */}
                {isLoading && (
                    <TaskGenerationLoading 
                        message="Processing your text with AI..." 
                        submessage="This may take a few moments"
                    />
                )}

                {/* Generate Tasks Button */}
                <View style={styles.generateButtonContainer}>
                    <PrimaryButton
                        title={isLoading ? "Generating..." : "Generate Tasks"}
                        onPress={handleGenerateTasks}
                        disabled={text.length < 4 || isLoading}
                    />
                </View>

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
    generateButtonContainer: {
        paddingVertical: 16,
        width: "100%",
    },
});

