import { StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import ChecklistToggle from "@/components/inputs/ChecklistToggle";
import ConditionalView from "@/components/ui/ConditionalView";
import { useDebounce } from "@/hooks/useDebounce";
import { updateChecklistAPI } from "@/api/task";

type ChecklistItem = {
    id?: string;
    content: string;
    completed: boolean;
    order: number;
};

type Props = {
    initialChecklist?: ChecklistItem[];
    onChecklistChange?: (checklist: ChecklistItem[]) => void;
    categoryId?: string;
    taskId?: string;
    autoSave?: boolean; // New prop to control auto-saving
};

const Checklist = ({ initialChecklist = [], onChecklistChange, categoryId, taskId, autoSave = false }: Props) => {
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initialChecklist);
    const [newItemContent, setNewItemContent] = useState<string>(""); // Add state for bottom input
    const ThemedColor = useThemeColor();
    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Debounced API call to update checklist
    const debouncedUpdateChecklist = useDebounce(async (checklist: ChecklistItem[]) => {
        if (autoSave && categoryId && taskId) {
            try {
                await updateChecklistAPI(categoryId, taskId, checklist);
            } catch (error) {
                console.error("Failed to update checklist:", error);
            }
        }
    }, 2000);

    // Notify parent component when checklist changes
    useEffect(() => {
        onChecklistChange?.(checklistItems);

        // Auto-save to API if enabled
        if (autoSave) {
            debouncedUpdateChecklist(checklistItems);
        }
    }, [checklistItems, onChecklistChange, autoSave, debouncedUpdateChecklist]);

    // Update refs array when checklist items change
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, checklistItems.length);
    }, [checklistItems.length]);

    const addEmptyChecklistItem = (afterIndex?: number) => {
        const insertIndex = afterIndex !== undefined ? afterIndex + 1 : checklistItems.length;
        setChecklistItems([
            ...checklistItems.slice(0, insertIndex),
            {
                content: "",
                completed: false,
                order: insertIndex,
            },
            ...checklistItems.slice(insertIndex).map((item, idx) => ({
                ...item,
                order: insertIndex + idx + 1,
            })),
        ]);

        // Focus the newly created item after state update
        setTimeout(() => {
            inputRefs.current[insertIndex]?.focus();
        }, 100);
    };

    const modifyChecklistItem = (index: number, content: string) => {
        setChecklistItems([
            ...checklistItems.slice(0, index),
            { ...checklistItems[index], content },
            ...checklistItems.slice(index + 1),
        ]);
    };

    const toggleChecklistItem = (index: number) => {
        setChecklistItems([
            ...checklistItems.slice(0, index),
            { ...checklistItems[index], completed: !checklistItems[index].completed },
            ...checklistItems.slice(index + 1),
        ]);
    };

    const removeChecklistItem = (index: number) => {
        const newItems = [...checklistItems.slice(0, index), ...checklistItems.slice(index + 1)];
        // Update order for items after the removed item
        const reorderedItems = newItems.map((item, idx) => ({
            ...item,
            order: idx,
        }));
        setChecklistItems(reorderedItems);
    };

    const handleKeyPress = (index: number, key: string) => {
        if (key === "Backspace" && checklistItems[index].content === "" && checklistItems.length > 1) {
            // Focus the previous item before deletion, or the next item if it's the first
            const focusIndex = index > 0 ? index - 1 : 0;

            removeChecklistItem(index);

            // Focus the appropriate item after deletion
            setTimeout(() => {
                // Adjust focus index if we deleted the first item
                const actualFocusIndex = index > 0 ? focusIndex : 0;
                inputRefs.current[actualFocusIndex]?.focus();
            }, 100);
        }
    };

    const addChecklistItemFromInput = () => {
        if (newItemContent.trim() === "") return; // Don't add empty items

        const newItem = {
            content: newItemContent.trim(),
            completed: false,
            order: checklistItems.length,
        };

        setChecklistItems([...checklistItems, newItem]);
        setNewItemContent(""); // Clear the input
    };

    const addChecklistItemAndCreateNew = () => {
        if (newItemContent.trim() === "") return; // Don't add empty items

        const newItem = {
            content: newItemContent.trim(),
            completed: false,
            order: checklistItems.length,
        };

        const emptyItem = {
            content: "",
            completed: false,
            order: checklistItems.length + 1,
        };

        setChecklistItems([...checklistItems, newItem, emptyItem]);
        setNewItemContent(""); // Clear the input

        // Focus the newly created empty item
        setTimeout(() => {
            inputRefs.current[checklistItems.length + 1]?.focus();
        }, 100);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={{ gap: 8 }}>
                <ConditionalView condition={checklistItems.length > 0}>
                    {checklistItems.map((item, index) => (
                        <View key={item.id || index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <ChecklistToggle checked={item.completed} onToggle={() => toggleChecklistItem(index)} />
                            <TextInput
                                ref={(ref) => {
                                    inputRefs.current[index] = ref;
                                }}
                                value={item.content}
                                onChangeText={(text) => {
                                    modifyChecklistItem(index, text);
                                }}
                                onSubmitEditing={() => addEmptyChecklistItem(index)}
                                onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 8,
                                    fontSize: 16,
                                    color: ThemedColor.body,
                                    fontFamily: "OutfitLight",
                                }}
                                placeholder="Enter checklist item"
                            />
                        </View>
                    ))}
                </ConditionalView>

                <ConditionalView condition={checklistItems.length === 0}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ChecklistToggle checked={false} onToggle={() => {}} />
                        <TextInput
                            value={newItemContent}
                            onChangeText={setNewItemContent}
                            onSubmitEditing={addChecklistItemAndCreateNew}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                fontSize: 16,
                                color: ThemedColor.body,
                                fontFamily: "OutfitLight",
                            }}
                            placeholder="Enter checklist item"
                        />
                    </View>
                </ConditionalView>
            </View>
        </KeyboardAvoidingView>
    );
};

export default Checklist;

const styles = StyleSheet.create({});
