import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

interface TemplateWithCategory {
    id: string;
    content: string;
    categoryName: string;
    categoryID: string;
    completionDates?: string[];
}

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    templates: TemplateWithCategory[];
    selectedTemplateIds: string[];
    onApply: (selectedIds: string[]) => void;
}

export default function RecurringTasksSelectionModal({
    visible,
    setVisible,
    templates,
    selectedTemplateIds,
    onApply,
}: Props) {
    const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedTemplateIds);
    const ThemedColor = useThemeColor();

    // Update local state when modal opens with new selected IDs
    React.useEffect(() => {
        if (visible) {
            setLocalSelectedIds(selectedTemplateIds);
        }
    }, [visible, selectedTemplateIds]);

    const toggleSelection = (templateId: string) => {
        setLocalSelectedIds((prev) => {
            if (prev.includes(templateId)) {
                return prev.filter((id) => id !== templateId);
            } else {
                return [...prev, templateId];
            }
        });
    };

    const handleApply = () => {
        onApply(localSelectedIds);
        setVisible(false);
    };

    const handleCancel = () => {
        setLocalSelectedIds(selectedTemplateIds);
        setVisible(false);
    };

    const renderItem = ({ item }: { item: TemplateWithCategory }) => {
        const isSelected = localSelectedIds.includes(item.id);

        return (
            <TouchableOpacity
                style={[
                    styles.templateItem,
                    {
                        backgroundColor: ThemedColor.lightenedCard,
                        borderColor: ThemedColor.tertiary,
                    },
                    isSelected && {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.10,
                        shadowRadius: 4,
                        elevation: 2,
                    },
                ]}
                onPress={() => toggleSelection(item.id)}
                activeOpacity={0.7}>
                <View style={styles.templateContent}>
                    <View style={styles.templateInfo}>
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            {item.categoryName}
                        </ThemedText>
                        <ThemedText type="defaultSemiBold">{item.content}</ThemedText>
                        {item.completionDates && item.completionDates.length > 0 && (
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                {item.completionDates.length} completion{item.completionDates.length !== 1 ? "s" : ""}
                            </ThemedText>
                        )}
                    </View>
                    <View
                        style={[
                            styles.checkbox,
                            {
                                backgroundColor: isSelected ? ThemedColor.primary : "transparent",
                                borderColor: isSelected ? "transparent" : ThemedColor.text,
                                borderWidth: isSelected ? 0 : 1.5,
                            },
                        ]}>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <DefaultModal visible={visible} setVisible={handleCancel} snapPoints={["80%"]}>
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>
                    Select Recurring Tasks
                </ThemedText>
                <ThemedText type="caption" style={[styles.subtitle, { color: ThemedColor.caption }]}>
                    Choose which recurring tasks to display in the activity breakdown
                </ThemedText>

                {templates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={ThemedColor.caption} />
                        <ThemedText type="default" style={{ color: ThemedColor.caption, marginTop: 16 }}>
                            No recurring tasks found
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: ThemedColor.caption, marginTop: 8, textAlign: "center" }}>
                            Create a recurring task to see it here
                        </ThemedText>
                    </View>
                ) : (
                    <>
                        <FlatList
                            data={templates}
                            renderItem={renderItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={false}
                        />

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton, { borderColor: ThemedColor.tertiary }]}
                                onPress={handleCancel}>
                                <ThemedText type="default">Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.applyButton, { backgroundColor: ThemedColor.primary }]}
                                onPress={handleApply}>
                                <ThemedText type="defaultSemiBold" style={{ color: "#FFFFFF" }}>
                                    Apply ({localSelectedIds.length})
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 8,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 16,
    },
    list: {
        gap: 12,
        paddingBottom: 16,
    },
    templateItem: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    templateContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    templateInfo: {
        flex: 1,
        gap: 4,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 12,
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    buttonContainer: {
        flexDirection: "row",
        gap: 12,
        paddingTop: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButton: {
        borderWidth: 1,
    },
    applyButton: {
        // backgroundColor set dynamically
    },
});

