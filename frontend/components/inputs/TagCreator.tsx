import { View, StyleSheet, Text, Dimensions, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "./ThemedInput";
import { ThemedView } from "../ThemedView";

type Props = {
    onTagsChange?: (tags: string[]) => void;
    placeholder?: string;
    initialTags?: string[];
    maxTags?: number;
};

const TagCreator = ({ onTagsChange, placeholder = "Add tags...", initialTags = [], maxTags = 10 }: Props) => {
    const ThemedColor = useThemeColor();
    const [inputValue, setInputValue] = useState("");
    const [tags, setTags] = useState<string[]>(initialTags);

    const addTag = () => {
        const trimmedValue = inputValue.trim();
        if (!trimmedValue || tags.includes(trimmedValue) || tags.length >= maxTags) {
            return;
        }

        const newTags = [...tags, trimmedValue];
        setTags(newTags);
        setInputValue("");
        onTagsChange?.(newTags);
    };

    const removeTag = (tagToRemove: string) => {
        const removedTags = tags.filter((tag) => tag !== tagToRemove);
        setTags(removedTags);
        onTagsChange?.(removedTags);
    };

    const handleInputSubmit = () => {
        addTag();
    };

    const handleInputChange = (text: string) => {
        if (text.includes(",") || text.includes(" ")) {
            const cleanText = text.replace(/[, ]+$/, "");
            if (cleanText.trim()) {
                setInputValue(cleanText);
                addTag();
            }
        } else {
            setInputValue(text);
        }
    };

    const styles = createStyles(ThemedColor);

    return (
        <View style={styles.container}>
            <View style={styles.header} >
                <ThemedText type="lightBody">
                    Tag
                </ThemedText>

                <ThemedText type="caption" style={styles.helperText}>
                    {tags.length > 0
                        ? `${tags.length}/${maxTags} tags. Tap to remove`
                        : "Type and press enter to add tags"}
                </ThemedText>
            </View>
            <ThemedInput
                    value={inputValue}
                    setValue={handleInputChange}
                    placeHolder={placeholder}
                    onSubmit={handleInputSubmit}
                    onChangeText={handleInputChange}
                />

            {tags.length > 0 && (
                <View style={styles.tagsContainer}>
                    {tags.map((tag, index) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => removeTag(tag)}
                            style={styles.tag}>
                            <ThemedText type="defaultSemiBold" style={styles.tagText}>
                                {tag}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flexDirection: "column",
            gap: 16,
            width: "100%",
        },
        header: {
            flexDirection: "row", 
            justifyContent: "space-between"
        },
        tagsContainer: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
        },
        tag: {
            flexDirection: "row",
            alignItems: "baseline",
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: ThemedColor.primary,
            borderRadius: 8,
            gap: 6,
        },
        tagText: {
            color: ThemedColor.buttonText,
            fontSize: 14,
        },
        helperText: {
            textAlign: "left",
            opacity: 0.7,
        },
    });

export default TagCreator;
