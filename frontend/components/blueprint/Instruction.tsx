// Step1Instruction.tsx
import React from "react";
import { View, StyleSheet, Keyboard } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import TagCreator from "@/components/inputs/TagCreator";
import ThemedInput from "@/components/inputs/ThemedInput";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";
import LongTextInput from "../inputs/LongTextInput";

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
    const handleDescriptionChange = (description: string) => {
        onUpdate({ description });
    };

    const handleTagsChange = (selectedTags: string[]) => {
        onUpdate({ selectedTags });
    };

    return (
        <View style={styles.stepContent}>
            <View style={styles.fieldContainer}>
                <ThemedInput
                    ghost
                    placeHolder="Enter Blueprint Name"
                    onBlur={() => {
                        Keyboard.dismiss();
                    }}
                    textStyle={{
                        fontSize: 24,
                        fontFamily: "Outfit",
                        fontWeight: "500",
                        letterSpacing: -0.2,
                    }}
                    value={data.blueprintName}
                    setValue={handleNameChange}
                />
                <LongTextInput
                    placeholder="Enter a Description"
                    value={data.description}
                    setValue={handleDescriptionChange}
                    fontSize={16}
                    minHeight={100}
                />
            </View>
            <View style={styles.separator} />

            <View style={styles.fieldContainer}>
                <TagCreator
                    onTagsChange={handleTagsChange}
                    placeholder="Enter Blueprint tags"
                    maxTags={10}
                    initialTags={data.selectedTags}
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
            borderRadius: 1,
            borderColor: ThemedColor.lightened,
        },
        separator: {
            height: 1,
            backgroundColor: ThemedColor.tertiary,
        },
        fieldLabel: {
            fontSize: 16,
            fontWeight: "500",
            color: ThemedColor.text,
        },
    });

export default Instructions;
