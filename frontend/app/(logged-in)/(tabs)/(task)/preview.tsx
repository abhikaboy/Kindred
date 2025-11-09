import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Task } from "@/api/types";
import TaskCard from "@/components/cards/TaskCard";

type Props = {};

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

    // Mock data - this would come from the AI generation in a real implementation
    const categories = [
        {
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
