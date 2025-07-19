import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
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

export type BlueprintData = {
    blueprintName: string;
    selectedTags: string[];
    bannerImage: string;
    description: string;
    duration: string;
    tasks: Task[];
    category: string;
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
    });

    const [isCreating, setIsCreating] = useState(false);

    const router = useRouter();
    const ThemedColor = useThemeColor();

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

            const createdBlueprint = await createBlueprintToBackend(
                blueprintData.bannerImage,
                blueprintData.blueprintName,
                blueprintData.selectedTags,
                blueprintData.description,
                blueprintData.duration
            );

            if (createdBlueprint) {
                console.log("Blueprint created successfully:", createdBlueprint);
                router.back();
            }
        } catch (error) {
            console.error("Error creating blueprint:", error);
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
            router.back();
        }
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

    const styles = createStyles(ThemedColor, insets);

    return (
        <ThemedView style={styles.container}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
            </TouchableOpacity>

            <View style={styles.header}>
                <ThemedText type="fancyFrauncesHeading">New Blueprint</ThemedText>
            </View>

            <View style={styles.progressContainer}>
                <StepProgress steps={steps} currentStep={currentStep} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {renderStepContent()}
            </ScrollView>

            <View style={styles.continueButtonContainer}>
                <PrimaryButton
                    title={currentStep === 3 ? "Create Blueprint" : "Continue"}
                    onPress={handleNext}
                    disabled={!isStepValid() || isCreating}
                />
            </View>
        </ThemedView>
    );
};

const createStyles = (ThemedColor: any, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            paddingTop: insets.top,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: 24,
        },
        backButton: {
            padding: 20,
        },
        progressContainer: {
            paddingLeft: 20,
        },
        scrollView: {
            flex: 1,
            height: "100%",
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 36,
            paddingBottom: 20,
        },
        continueButtonContainer: {
            paddingHorizontal: 20,
            paddingBottom: insets.bottom,
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
