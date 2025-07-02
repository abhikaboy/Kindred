import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TagCreator from "@/components/inputs/TagCreator";
import ThemedInput from "../inputs/ThemedInput";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import { Ionicons } from "@expo/vector-icons";
import StepProgress from "./StepTracker";

type Task = {
    id: string;
    title: string;
    category: string;
    priority: "high" | "medium" | "low";
    completed?: boolean;
};

const InstructionCreationPage = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [blueprintName, setBlueprintName] = useState("");
    const [bannerImage, setBannerImage] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState("");
    const [tasks, setTasks] = useState<Task[]>([]);

    const router = useRouter();
    const ThemedColor = useThemeColor();

    const steps = [
        { number: 1, title: "Instruction" },
        { number: 2, title: "Details" },
        { number: 3, title: "Tasks" },
    ];

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        } else {
            console.log("Creating blueprint:", {
                blueprintName,
                selectedTags,
                bannerImage,
                description,
                duration,
                tasks,
            });
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    const handleImageSelected = (imageUri: string) => {
        setBannerImage(imageUri);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.fieldContainer}>
                            <ThemedText type="lightBody">
                                Name
                            </ThemedText>
                            <ThemedInput
                                value={blueprintName}
                                setValue={setBlueprintName}
                                placeHolder="Enter Blueprint name"
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <TagCreator
                                onTagsChange={setSelectedTags}
                                placeholder="Enter Blueprint tags"
                                maxTags={10}
                                initialTags={[]}
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <ThemedText type="lightBody">
                                Banner Image
                            </ThemedText>
                        </View>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.fieldContainer}>
                            <ThemedText type="lightBody">
                                Description
                            </ThemedText>
                            <ThemedInput
                                value={description}
                                setValue={setDescription}
                                placeHolder="Describe your blueprint"
                                textStyle={{ minHeight: 100, textAlignVertical: "top" }}
                                textArea={true}
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <ThemedText type="lightBody">
                                Frequency
                            </ThemedText>
                            <ThemedInput
                                value={duration}
                                setValue={setDuration}
                                placeHolder="Enter Duration of blueprint"
                            />
                        </View>
                    </View>
                );

            case 3:
                return (
                    <ThemedText type="default" style={styles.headerTitle}>
                        Tasks
                    </ThemedText>
                );

            default:
                return null;
        }
    };

    const styles = createStyles(ThemedColor);

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
                showsVerticalScrollIndicator={false}>
                {renderStepContent()}
            </ScrollView>
            <View style={styles.continueButtonContainer}>
                <PrimaryButton title="Continue" onPress={handleNext} style={styles.continueButton} />
            </View>
        </ThemedView>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            paddingTop: 60,
            paddingBottom: 100,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
        },
        backButton: {
            padding: 20,
        },
        headerTitle: {
            flex: 1,
            textAlign: "center",
            fontSize: 24,
            fontWeight: "600",
        },
        progressContainer: {
            paddingLeft: 20,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 36,
            paddingBottom: 20,
        },
        stepContent: {
            gap: 32,
        },
        fieldContainer: {
            gap: 12,
        },
        categorySection: {
            marginBottom: 32,
        },
        categoryTitle: {
            fontSize: 28,
            fontWeight: "600",
            marginBottom: 16,
            color: ThemedColor.text,
        },
        continueButtonContainer: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 36,
        },
        continueButton: {
            paddingVertical: 16,
            backgroundColor: ThemedColor.primary,
            borderRadius: 12,
        },
    });

export default InstructionCreationPage;
