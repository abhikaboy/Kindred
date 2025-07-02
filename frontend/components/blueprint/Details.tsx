import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "@/components/inputs/ThemedInput";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Details = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    const handleDescriptionChange = (description: string) => {
        onUpdate({ description });
    };

    const handleDurationChange = (duration: string) => {
        onUpdate({ duration });
    };

    return (
        <View style={styles.stepContent}>
            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Description
                </ThemedText>
                <ThemedInput
                    value={data.description}
                    setValue={handleDescriptionChange}
                    placeHolder="Describe your blueprint"
                    textStyle={{ minHeight: 100, textAlignVertical: "top" }}
                    textArea={true}
                />
            </View>

            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Frequency or Duration
                </ThemedText>
                <ThemedInput
                    value={data.duration}
                    setValue={handleDurationChange}
                    placeHolder="Enter Frequency or Duration of blueprint"
                />
            </View>
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        stepContent: {
            gap: 32,
        },
        fieldContainer: {
            gap: 12,
        },
        fieldLabel: {
            fontSize: 16,
            fontWeight: "500",
            color: ThemedColor.text,
        },
    });

export default Details;
