import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter, useLocalSearchParams } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Task } from "@/api/types";
import TaskCard from "@/components/cards/TaskCard";
import type { components } from "@/api/generated/types";
import { useTasks } from "@/contexts/tasksContext";

type TaskDocument = components["schemas"]["TaskDocument"];
type Props = {};

interface GroupedCategory {
    workspace?: string;
    categoryName: string;
    categoryId: string;
    tasks: Task[];
    isNew: boolean;
}

// Preview task item that looks like a real task but isn't swipable
const PreviewTaskItem = ({ 
    task, 
    categoryId 
}: { 
    task: Task; 
    categoryId: string;
}) => {
    return (
        <TaskCard
            content={task.content}
            value={task.value}
            priority={task.priority as any}
            id={task.id}
            categoryId={categoryId}
            redirect={false}
            task={task}
        />
    );
};

// Category section for preview
const PreviewCategorySection = ({
    workspace,
    categoryName,
    tasks,
    isNew,
}: {
    workspace?: string;
    categoryName: string;
    tasks: Task[];
    isNew?: boolean;
}) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={styles.categorySection}>
            {/* Workspace label if provided */}
            {workspace && (
                <View style={styles.metaRow}>
                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        Workspace: {workspace}
                    </ThemedText>
                    {isNew && (
                        <View style={[styles.newBadge, { backgroundColor: ThemedColor.primary + '20' }]}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary, fontSize: 11 }}>
                                NEW
                            </ThemedText>
                        </View>
                    )}
                </View>
            )}
            
            {/* Category header */}
            <View style={styles.categoryHeader}>
                <ThemedText type="subtitle" style={styles.categoryTitle}>
                    {categoryName}
                </ThemedText>
                {!workspace && isNew && (
                    <View style={[styles.newBadge, { backgroundColor: ThemedColor.primary + '20' }]}>
                        <ThemedText type="caption" style={{ color: ThemedColor.primary, fontSize: 11 }}>
                            NEW
                        </ThemedText>
                    </View>
                )}
            </View>
            
            {/* Tasks list */}
            <View style={styles.tasksList}>
                {tasks.map((task, index) => (
                    <PreviewTaskItem 
                        key={index} 
                        task={task} 
                        categoryId={`preview-${index}`} 
                    />
                ))}
            </View>
        </View>
    );
};

const Preview = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { workspaces } = useTasks();

    // Parse the tasks from route params
    const tasksData = useMemo(() => {
        if (!params.tasks || typeof params.tasks !== 'string') {
            return [];
        }
        try {
            return JSON.parse(params.tasks) as TaskDocument[];
        } catch (error) {
            console.error("Failed to parse tasks data:", error);
            return [];
        }
    }, [params.tasks]);

    const categoriesCreated = params.categoriesCreated ? Number(params.categoriesCreated) : 0;
    const tasksCreated = params.tasksCreated ? Number(params.tasksCreated) : 0;

    // Build a map of categoryId to category info from workspaces
    const categoryMap = useMemo(() => {
        const map = new Map<string, { name: string; workspace: string; isNew: boolean }>();
        
        workspaces.forEach(workspace => {
            workspace.categories.forEach(category => {
                map.set(category.id, {
                    name: category.name,
                    workspace: workspace.name,
                    isNew: false, // Existing categories from workspaces
                });
            });
        });
        
        return map;
    }, [workspaces]);

    // Track which categories have new tasks from this generation
    const newCategoryIds = useMemo(() => {
        const ids = new Set<string>();
        const existingIds = new Set(categoryMap.keys());
        
        tasksData.forEach(task => {
            if (task.categoryID && !existingIds.has(task.categoryID)) {
                ids.add(task.categoryID);
            }
        });
        
        return ids;
    }, [tasksData, categoryMap]);

    // Group tasks by category
    const groupedCategories = useMemo(() => {
        const groups = new Map<string, GroupedCategory>();
        
        tasksData.forEach((taskDoc) => {
            const categoryId = taskDoc.categoryID;
            if (!categoryId) return;
            
            // Convert TaskDocument to Task format
            const task: Task = {
                id: taskDoc.id,
                content: taskDoc.content,
                value: taskDoc.value,
                priority: taskDoc.priority,
                recurring: taskDoc.recurring,
                recurFrequency: taskDoc.recurFrequency,
                recurType: taskDoc.recurType,
                recurDetails: taskDoc.recurDetails as any, // Type cast to handle schema differences
                public: taskDoc.public,
                active: taskDoc.active,
                timestamp: taskDoc.timestamp,
                lastEdited: taskDoc.lastEdited,
                templateID: taskDoc.templateID,
                userID: taskDoc.userID,
                categoryID: taskDoc.categoryID,
            };
            
            if (!groups.has(categoryId)) {
                const categoryInfo = categoryMap.get(categoryId);
                const isNew = newCategoryIds.has(categoryId);
                
                groups.set(categoryId, {
                    categoryId,
                    categoryName: categoryInfo?.name || "Unknown Category",
                    workspace: categoryInfo?.workspace,
                    tasks: [],
                    isNew: isNew || categoriesCreated > 0, // Mark as new if it's a newly created category
                });
            }
            
            groups.get(categoryId)!.tasks.push(task);
        });
        
        return Array.from(groups.values());
    }, [tasksData, categoryMap, newCategoryIds, categoriesCreated]);

    // Use grouped categories for rendering (with fallback mock data for preview)
    const categories = groupedCategories.length > 0 ? groupedCategories : [
        {
            categoryId: "preview-cat-1",
            workspace: "Personal",
            categoryName: "Homework",
            isNew: true,
            tasks: [
                { 
                    id: "preview-1",
                    content: "Complete math assignment chapter 5",
                    value: 10,
                    priority: 2,
                    categoryID: "preview-cat-1",
                    recurring: false,
                    public: false,
                    active: true,
                    timestamp: new Date().toISOString(),
                    lastEdited: new Date().toISOString(),
                },
                { 
                    id: "preview-2",
                    content: "Write essay for English class",
                    value: 8,
                    priority: 1,
                    categoryID: "preview-cat-1",
                    recurring: false,
                    public: false,
                    active: true,
                    timestamp: new Date().toISOString(),
                    lastEdited: new Date().toISOString(),
                },
            ] as Task[],
        },
        {
            categoryId: "preview-cat-2",
            categoryName: "Fitness",
            isNew: true,
            tasks: [
                { 
                    id: "preview-3",
                    content: "Go to the gym at 7 AM",
                    value: 5,
                    priority: 0,
                    categoryID: "preview-cat-2",
                    recurring: false,
                    public: false,
                    active: true,
                    timestamp: new Date().toISOString(),
                    lastEdited: new Date().toISOString(),
                },
                { 
                    id: "preview-4",
                    content: "Prepare protein shake",
                    value: 3,
                    priority: 0,
                    categoryID: "preview-cat-2",
                    recurring: false,
                    public: false,
                    active: true,
                    timestamp: new Date().toISOString(),
                    lastEdited: new Date().toISOString(),
                },
            ] as Task[],
        },
        {
            categoryId: "preview-cat-3",
            workspace: "Work",
            categoryName: "Development",
            isNew: false,
            tasks: [
                { 
                    id: "preview-5",
                    content: "Review pull requests",
                    value: 12,
                    priority: 2,
                    categoryID: "preview-cat-3",
                    recurring: false,
                    public: false,
                    active: true,
                    timestamp: new Date().toISOString(),
                    lastEdited: new Date().toISOString(),
                },
            ] as Task[],
        },
    ];

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.container}>
                {/* Back Button */}
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                        Preview
                    </ThemedText>
                    <ThemedText type="default" style={[styles.subtitle, { color: ThemedColor.caption }]}>
                        Review your generated tasks before adding them
                    </ThemedText>
                </View>

                {/* Categories and Tasks */}
                <View style={styles.contentContainer}>
                    {categories.map((category, index) => (
                        <PreviewCategorySection
                            key={index}
                            workspace={category.workspace}
                            categoryName={category.categoryName}
                            tasks={category.tasks}
                            isNew={category.isNew}
                        />
                    ))}
                </View>
            </ScrollView>

            {/* Bottom Create Button - Fixed at bottom */}
            <View
                style={[
                    styles.bottomButtonContainer,
                    { 
                        backgroundColor: ThemedColor.background,
                        borderTopColor: ThemedColor.tertiary + '40',
                    },
                ]}>
                <PrimaryButton 
                    title="Create Tasks" 
                    onPress={() => {
                        // Navigate to tasks index page
                        router.push("/(logged-in)/(tabs)/(task)" as any);
                    }} 
                />
            </View>
        </ThemedView>
    );
};

export default Preview;

const styles = StyleSheet.create({
    container: {
        paddingTop: Dimensions.get("screen").height * 0.07,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 120, // Extra padding for fixed bottom button
    },
    backButton: {
        marginBottom: 16,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 4,
        gap: 8,
    },
    title: {
        fontWeight: "600",
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    contentContainer: {
        gap: 32,
    },
    categorySection: {
        gap: 12,
    },
    metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    categoryTitle: {
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: -0.5,
    },
    newBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    tasksList: {
        gap: 12,
    },
    bottomButtonContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 8,
    },
});
