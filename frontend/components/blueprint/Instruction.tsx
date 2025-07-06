// Step1Instruction.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import TagCreator from "@/components/inputs/TagCreator";
import ThemedInput from "@/components/inputs/ThemedInput";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Instructions = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    const handleNameChange = (blueprintName: string) => {
        onUpdate({ blueprintName });
    };

    const handleTagsChange = (selectedTags: string[]) => {
        onUpdate({ selectedTags });
    };

    const handleImageSelected = (bannerImage: string) => {
        onUpdate({ bannerImage });
    };

    return (
        <View style={styles.stepContent}>
            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Name
                </ThemedText>
                <ThemedInput
                    value={data.blueprintName}
                    setValue={handleNameChange}
                    placeHolder="Enter Blueprint name"
                />
            </View>

            <View style={styles.fieldContainer}>
                <TagCreator
                    onTagsChange={handleTagsChange}
                    placeholder="Enter Blueprint tags"
                    maxTags={10}
                    initialTags={data.selectedTags}
                />
            </View>

            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Banner Image
                </ThemedText>
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

export default Instructions;
