// Step3Tasks.tsx
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import CreateModal from "@/components/modals/CreateModal";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useBlueprints } from "@/contexts/blueprintContext";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";
import { Category } from "@/components/category";
import { Task } from "@/api/types";

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Tasks = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { blueprintCategories } = useBlueprints();
    const styles = createStyles(ThemedColor);

    // Debug logging to verify data structure
    console.log("🔍 Tasks Component Debug:");
    console.log("  - blueprintCategories:", blueprintCategories);
    console.log("  - categories count:", blueprintCategories.length);
    blueprintCategories.forEach((cat, index) => {
        console.log(`  - Category ${index + 1}:`, {
            id: cat.id,
            name: cat.name,
            tasksCount: cat.tasks?.length || 0,
            tasks: cat.tasks?.map(t => ({ id: t.id, content: t.content }))
        });
    });

    const handleCategoryPress = (categoryId: string) => {
        // Handle category press - could open task creation modal for this category
        setShowCreateModal(true);
    };

    const handleCategoryLongPress = (categoryId: string) => {
        // Handle category long press - could show options like edit/delete
        console.log("Long pressed category:", categoryId);
    };

    // Convert blueprint context tasks to Task interface
    const convertToTaskInterface = (blueprintTask: any): Task => {
        return {
            id: blueprintTask.id,
            priority: blueprintTask.priority,
            content: blueprintTask.content,
            value: blueprintTask.value,
            recurring: blueprintTask.recurring,
            recurFrequency: blueprintTask.recurFrequency,
            recurType: blueprintTask.recurType,
            recurDetails: blueprintTask.recurDetails,
            public: blueprintTask.public,
            active: blueprintTask.active,
            timestamp: blueprintTask.timestamp,
            lastEdited: blueprintTask.lastEdited,
            templateID: blueprintTask.templateID,
            userID: blueprintTask.userID,
            categoryID: blueprintTask.categoryID,
            deadline: blueprintTask.deadline,
            startTime: blueprintTask.startTime,
            startDate: blueprintTask.startDate,
            notes: blueprintTask.notes,
            checklist: blueprintTask.checklist || [],
            reminders: blueprintTask.reminders || [],
        };
    };

    return (
        <View style={styles.stepContent}>
            <ThemedText type="title" style={styles.sectionTitle}>
                Tasks
            </ThemedText>

            <ThemedText type="default" style={styles.sectionDescription}>
                Add tasks that users will complete as part of this blueprint
            </ThemedText>

            {/* Display existing categories using Category component */}
            {blueprintCategories.length > 0 && (
                <View style={styles.categoriesContainer}>
                    {blueprintCategories.map((category) => (
                        <Category
                            key={category.id}
                            id={category.id}
                            name={category.name}
                            tasks={category.tasks.map(convertToTaskInterface)}
                            onPress={handleCategoryPress}
                            onLongPress={handleCategoryLongPress}
                        />
                    ))}
                </View>
            )}

            <PrimaryButton
                title="+ Add Task"
                onPress={() => setShowCreateModal(true)}
            />

            <CreateModal
                visible={showCreateModal}
                setVisible={setShowCreateModal}
                isBlueprint={true}
            />
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        stepContent: {
            gap: 8,
        },
        sectionTitle: {
            fontSize: 28,
            fontWeight: "600",
            textAlign: "left",
            marginBottom: 8,
        },
        sectionDescription: {
            textAlign: "left",
            opacity: 0.7,
            marginBottom: 16,
        },
        categoriesContainer: {
            backgroundColor: ThemedColor.backgroundSecondary,
            borderRadius: 8,
            marginBottom: 16,
        },
        debugContainer: {
            backgroundColor: ThemedColor.backgroundSecondary,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        debugTitle: {
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 8,
        },
        debugText: {
            fontSize: 16,
            marginBottom: 4,
        },
        debugWarning: {
            color: ThemedColor.warning,
            fontSize: 14,
            marginTop: 8,
        },
    });

export default Tasks;
