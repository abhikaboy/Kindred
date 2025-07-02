// Step3Tasks.tsx
import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import ThemedInput from "@/components/inputs/ThemedInput";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Tasks = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    return (
        <View style={styles.stepContent}>
            <ThemedText type="title" style={styles.sectionTitle}>
                Tasks
            </ThemedText>

            <ThemedText type="default" style={styles.sectionDescription}>
                Add tasks that users will complete as part of this blueprint
            </ThemedText>
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        stepContent: {
            gap: 24,
        },
        sectionTitle: {
            fontSize: 28,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 8,
        },
        sectionDescription: {
            textAlign: "center",
            opacity: 0.7,
            marginBottom: 16,
        },
    });

export default Tasks;
