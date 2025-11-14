import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Keyboard, Animated, Alert } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import Instructions from "@/components/blueprint/Instruction";
import Details from "@/components/blueprint/Details";
import Tasks from "@/components/blueprint/Tasks";
import StepProgress from "@/components/blueprint/StepTracker";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { createBlueprintToBackend } from "@/api/blueprint";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BlueprintIntroBottomSheet from "@/components/modals/BlueprintIntroBottomSheet";
import { components } from "@/api/types";
import { useBlueprints } from "@/contexts/blueprintContext";

type Category = components["schemas"]["CategoryDocument"];

export type BlueprintData = {
    blueprintName: string;
    selectedTags: string[];
    bannerImage: string;
    description: string;
    duration: string;
    tasks: Task[];
    category: string;
    categories: Category[];
};

export type Task = {
    id: string;
    title: string;
    category: string;
    priority: "high" | "medium" | "low";
    completed?: boolean;
};

const BlueprintCreationLayout = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const insets = useSafeAreaInsets();
    const [blueprintData, setBlueprintData] = useState<BlueprintData>({
        blueprintName: "",
        selectedTags: [],
        bannerImage: "",
        description: "",
        duration: "",
        tasks: [],
        category: "",
        categories: [],
    });

    const [isCreating, setIsCreating] = useState(false);
    const [showBlueprintIntro, setShowBlueprintIntro] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    
    // Animation values for header collapse
    const headerHeight = new Animated.Value(1);
    const titleOpacity = new Animated.Value(1);
    const progressOpacity = new Animated.Value(1);

    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { blueprintCategories, clearBlueprintData } = useBlueprints();

    const steps = [
        { number: 1, title: "Instruction" },
        { number: 2, title: "Details" },
        { number: 3, title: "Tasks" },
    ];

    const updateBlueprintData = (updates: Partial<BlueprintData>) => {
        setBlueprintData((prev) => ({ ...prev, ...updates }));
    };

    const handleCreateBlueprint = async () => {
        try {
            setIsCreating(true);

            // Debug logging to verify data structure
            console.log("🔍 Blueprint Creation Data:");
            console.log("  - category (string):", blueprintData.category);
            console.log("  - categories (array):", blueprintCategories);
            console.log("  - categories length:", blueprintCategories.length);
            
            // Validate that we have the required data
            if (!blueprintData.category) {
                throw new Error("Blueprint category is required");
            }
            
            if (blueprintCategories.length === 0) {
                throw new Error("At least one category with tasks is required");
            }

            // Validate that categories have tasks
            const categoriesWithTasks = blueprintCategories.filter(cat => cat.tasks && cat.tasks.length > 0);
            if (categoriesWithTasks.length === 0) {
                throw new Error("At least one category must contain tasks");
            }

            console.log("✅ Validation passed - creating blueprint...");

            const createdBlueprint = await createBlueprintToBackend(
                blueprintData.bannerImage,
                blueprintData.blueprintName,
                blueprintData.selectedTags,
                blueprintData.description,
                blueprintData.duration,
                blueprintData.category,
                blueprintCategories
            );

            if (createdBlueprint) {
                console.log("Blueprint created successfully:", createdBlueprint);
                // Clear the blueprint context data after successful creation
                clearBlueprintData();
                router.back();
            }
        } catch (error) {
            console.error("Error creating blueprint:", error);
            // Show user-friendly error message
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to create blueprint");
        } finally {
            setIsCreating(false);
        }
    };

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        } else {
            handleCreateBlueprint();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            // Clear blueprint context data when leaving the creation flow
            clearBlueprintData();
            router.back();
        }
    };

    // Show blueprint intro on first step load
    React.useEffect(() => {
        if (currentStep === 1) {
            const timer = setTimeout(() => {
                setShowBlueprintIntro(true);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [currentStep]);

    // Clear blueprint context data when component unmounts
    React.useEffect(() => {
        return () => {
            clearBlueprintData();
        };
    }, [clearBlueprintData]);

    // Keyboard event handlers
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setIsKeyboardVisible(true);
            // Animate header to collapsed state
            Animated.parallel([
                Animated.timing(headerHeight, {
                    toValue: 0.3,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(titleOpacity, {
                    toValue: 0.7,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(progressOpacity, {
                    toValue: 0.5,
                    duration: 300,
                    useNativeDriver: false,
                }),
            ]).start();
        });

        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setIsKeyboardVisible(false);
            // Animate header back to expanded state
            Animated.parallel([
                Animated.timing(headerHeight, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(titleOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.timing(progressOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
            ]).start();
        });

        return () => {
            keyboardDidShowListener?.remove();
            keyboardDidHideListener?.remove();
        };
    }, []);

    const handleBuildBlueprint = () => {
        setShowBlueprintIntro(false);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return <Instructions data={blueprintData} onUpdate={updateBlueprintData} />;
            case 2:
                return <Details data={blueprintData} onUpdate={updateBlueprintData} />;
            case 3:
                return <Tasks data={blueprintData} onUpdate={updateBlueprintData} />;
            default:
                return null;
        }
    };

    const isStepValid = () => {
        switch (currentStep) {
            case 1:
                return blueprintData.blueprintName.trim() && blueprintData.selectedTags.length > 0;
            case 2:
                return blueprintData.description.trim() && blueprintData.duration.trim();
            case 3:
                return true;
            default:
                return false;
        }
    };

    const styles = createStyles(ThemedColor, insets, isKeyboardVisible);

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView 
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={0}
            >
                {/* Animated Header Section */}
                <Animated.View style={[
                    styles.fixedHeader,
                    {
                        transform: [{ scaleY: headerHeight }],
                        opacity: titleOpacity,
                    }
                ]}>
                    {/* Header */}
                    <Animated.View style={[
                        styles.header,
                        {
                            opacity: titleOpacity,
                            transform: [{ scaleY: headerHeight }],
                        }
                    ]}>
                        <View style={styles.titleContainer}>
                            <ThemedText type="fancyFrauncesHeading" style={styles.titleText}>
                                New Blueprint
                            </ThemedText>
                            <ThemedText style={styles.subtitleText}>
                                Create a shareable to-do list
                            </ThemedText>
                        </View>
                    </Animated.View>

                    {/* Progress Container */}
                    <Animated.View style={[
                        styles.progressContainer,
                        {
                            opacity: progressOpacity,
                            transform: [{ scaleY: headerHeight }],
                        }
                    ]}>
                        <StepProgress steps={steps} currentStep={currentStep} />
                    </Animated.View>
                </Animated.View>

                {/* Main Content */}
                <View style={{
                    flex: 1,
                    backgroundColor: ThemedColor.background, 
                    borderRadius: 24, 
                }}>
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {renderStepContent()}
                    </ScrollView>

                    <View style={styles.continueButtonContainer}>
                        <PrimaryButton
                            title={currentStep === 3 ? "Create Blueprint" : "Continue"}
                            onPress={handleNext}
                            disabled={!isStepValid() || isCreating}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>

            <BlueprintIntroBottomSheet
                isVisible={showBlueprintIntro}
                onClose={() => setShowBlueprintIntro(false)}
                onBuildBlueprint={handleBuildBlueprint}
            />
        </View>
    );
};

const HORIZONTAL_PADDING = 20;

const createStyles = (ThemedColor: any, insets: any, isKeyboardVisible: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            paddingTop: insets.top,
        },
        fixedHeader: {
            // This ensures the header section has a defined size
            minHeight: 100,
            maxHeight: 130,
            marginTop: 24,
        },
        header: {
            justifyContent: "flex-start",
            alignItems: "flex-start",
            paddingHorizontal: 20,
            paddingBottom: 8,
        },
        titleContainer: {
            gap: 4,
        },
        titleText: {
            fontSize: 32,
            letterSpacing: -1.5,
            lineHeight: 38,
        },
        subtitleText: {
            fontSize: 15,
            color: ThemedColor.caption,
            fontFamily: "Outfit",
            letterSpacing: 0.2,
        },
        backButton: {
            position: "absolute",
            left: 20,
            bottom: 16,
        },
        progressContainer: {
            minHeight: isKeyboardVisible ? 40 : 100,
            paddingLeft: HORIZONTAL_PADDING,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 20,
        },
        continueButtonContainer: {
            paddingHorizontal: 20,
            gap: 12,
            paddingBottom: insets.bottom + 0,
        },
        continueButton: {
            paddingVertical: 16,
            backgroundColor: ThemedColor.primary,
            borderRadius: 12,
        },
        continueButtonDisabled: {
            backgroundColor: ThemedColor.tertiary,
            opacity: 0.5,
        },
    });

export default BlueprintCreationLayout;
