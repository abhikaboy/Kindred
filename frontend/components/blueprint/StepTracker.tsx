import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

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

const StepProgress = ({ steps, currentStep, onStepPress }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    const getStepState = (stepNumber: number) => {
        if (stepNumber < currentStep) return "completed";
        if (stepNumber === currentStep) return "active";
        return "inactive";
    };

    const renderStep = (step: Step, index: number) => {
        const state = getStepState(step.number);
        const isLast = index === steps.length - 1;
        const nextStepState = !isLast ? getStepState(step.number + 1) : null;
        
        const lineActive = state === "completed" || nextStepState === "active" || nextStepState === "completed";

        return (
            <View key={step.number} style={styles.stepContainer}>
                <View style={styles.stepWrapper}>
                    <View style={[
                        styles.stepCircle,
                        state === "completed" && styles.stepCircleCompleted,
                        state === "active" && styles.stepCircleActive,
                        state === "inactive" && styles.stepCircleInactive,
                    ]}>
                        {state === "completed" ? (
                            <Ionicons 
                                name="checkmark" 
                                size={16} 
                                color={ThemedColor.buttonText} 
                            />
                        ) : (
                            <ThemedText 
                                type="defaultSemiBold" 
                                style={[
                                    styles.stepNumber,
                                    state === "active" && styles.stepNumberActive,
                                    state === "inactive" && styles.stepNumberInactive,
                                ]}
                            >
                                {step.number}
                            </ThemedText>
                        )}
                    </View>
                    {!isLast && (
                        <View style={[
                            styles.connectingLine,
                            lineActive && styles.connectingLineActive,
                        ]} />
                    )}
                </View>
                <ThemedText 
                    type="subtitle" 
                    style={[
                        styles.stepTitle,
                        state === "active" && styles.stepTitleActive,
                        state === "inactive" && styles.stepTitleInactive,
                    ]}
                >
                    {step.title}
                </ThemedText>
            </View>
        );
    };

    return (
        <View>
            <View style={styles.stepsRow}>
                {steps.map((step, index) => renderStep(step, index))}
            </View>
        </View>
    );
};

const createStyles = (ThemedColor: any) => StyleSheet.create({
    stepsRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        position: "relative",
    },
    stepContainer: {
        flex: 1,
        alignItems: "baseline",
        position: "relative",
        width: "100%"
    },
    stepWrapper: {
        flexDirection: "row",
        alignItems: "baseline",
        width: "100%",
        position: "relative",
        marginBottom: 12,
        justifyContent: "flex-start",
    },
    stepCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2,
    },
    stepCircleCompleted: {
        backgroundColor: ThemedColor.primary,
    },
    stepCircleActive: {
        backgroundColor: ThemedColor.primary,
    },
    stepCircleInactive: {
        backgroundColor: ThemedColor.tertiary,
    },
    stepNumber: {
        fontSize: 16,
        fontWeight: "600",
    },
    stepNumberActive: {
        color: ThemedColor.buttonText,
    },
    stepNumberInactive: {
        color: ThemedColor.caption,
    },
    connectingLine: {
        position: "absolute",
        left: 25, 
        right: -25,
        height: 2,
        backgroundColor: ThemedColor.tertiary,
        top: 17, 
        zIndex: 1,
    },
    connectingLineActive: {
        backgroundColor: ThemedColor.primary,
    },
    stepTitle: {
        textAlign: "center",
        fontSize: 14,
        fontWeight: "400",
        marginTop: 4,
    },
    stepTitleActive: {
        color: ThemedColor.text,
    },
    stepTitleInactive: {
        color: ThemedColor.caption,
    },
});

export default StepProgress;