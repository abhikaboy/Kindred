import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Step = {
    number: number;
    title: string;
    completed?: boolean;
};

type Props = {
    steps: Step[];
    currentStep: number;
    onStepPress?: (stepNumber: number) => void;
};

const StepProgress = ({ steps, currentStep }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    return (
        <View style={styles.container}>
            <View style={styles.textContainer}>
                <ThemedText style={styles.stepText}>
                    Step {currentStep} of {steps.length}
                </ThemedText>
                <ThemedText style={styles.stepTitle}>
                    {steps[currentStep - 1]?.title}
                </ThemedText>
            </View>
            
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                    <View 
                        style={[
                            styles.progressBarFill,
                            { width: `${(currentStep / steps.length) * 100}%` }
                        ]} 
                    />
                </View>
            </View>
        </View>
    );
};

const createStyles = (ThemedColor: any) => StyleSheet.create({
    container: {
        gap: 8,
        paddingVertical: 8,
        paddingRight: 20,
    },
    textContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    stepText: {
        fontSize: 11,
        fontFamily: "Outfit",
        color: ThemedColor.caption,
        fontWeight: "500",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    stepTitle: {
        fontSize: 14,
        fontFamily: "Outfit",
        color: ThemedColor.text,
        fontWeight: "500",
    },
    progressBarContainer: {
        width: "100%",
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: ThemedColor.tertiary,
        borderRadius: 2,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: ThemedColor.primary,
        borderRadius: 2,
    },
});

export default StepProgress;