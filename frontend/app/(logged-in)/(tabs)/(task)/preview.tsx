import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";

type Props = {};

// Mock task item component matching the design
const TaskItem = ({ content, isCompleted }: { content: string; isCompleted?: boolean }) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View
            style={[
                styles.taskItem,
                {
                    backgroundColor: ThemedColor.lightened,
                    borderColor: ThemedColor.tertiary,
                },
            ]}>
            <ThemedText type="default" style={styles.taskContent}>
                {content}
            </ThemedText>
            <View
                style={[
                    styles.statusIndicator,
                    { backgroundColor: isCompleted ? "#54e788" : "#ff5c5f" },
                ]}
            />
            <ThemedText
                type="caption"
                style={[
                    styles.taskNumber,
                    { color: ThemedColor.text },
                ]}>
                16
            </ThemedText>
        </View>
    );
};

// Category section component
const CategorySection = ({
    workspace,
    categoryName,
    tasks,
    isNew,
}: {
    workspace?: string;
    categoryName: string;
    tasks: { content: string; isCompleted?: boolean }[];
    isNew?: boolean;
}) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={styles.categorySection}>
            {workspace && (
                <View style={styles.workspaceRow}>
                    <ThemedText type="caption" style={{ color: ThemedColor.text }}>
                        Workspace
                    </ThemedText>
                    {isNew && (
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            New
                        </ThemedText>
                    )}
                </View>
            )}
            <View style={styles.categoryHeader}>
                <ThemedText type="subtitle" style={{ color: ThemedColor.text }}>
                    {categoryName}
                </ThemedText>
                {!workspace && isNew && (
                    <ThemedText type="subtitle" style={{ color: ThemedColor.primary }}>
                        New
                    </ThemedText>
                )}
            </View>
            <View style={styles.tasksList}>
                {tasks.map((task, index) => (
                    <TaskItem key={index} content={task.content} isCompleted={task.isCompleted} />
                ))}
            </View>
        </View>
    );
};

const Preview = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();

    // Mock data matching the Figma design
    const categories = [
        {
            workspace: "Workspace",
            categoryName: "Category 1",
            isNew: true,
            tasks: [
                { content: "do my hw lol", isCompleted: true },
                { content: "do my hw lol", isCompleted: false },
            ],
        },
        {
            categoryName: "Category 2",
            isNew: true,
            tasks: [
                { content: "do my hw lol", isCompleted: true },
                { content: "do my hw lol", isCompleted: false },
            ],
        },
        {
            workspace: "Workspace",
            categoryName: "Category 2",
            isNew: true,
            tasks: [
                { content: "do my hw lol", isCompleted: true },
                { content: "do my hw lol", isCompleted: false },
            ],
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
                </View>

                {/* Categories and Tasks */}
                <View style={styles.contentContainer}>
                    {categories.map((category, index) => (
                        <CategorySection
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
                    { backgroundColor: ThemedColor.background },
                ]}>
                <PrimaryButton 
                    title="Create" 
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
        paddingBottom: 100, // Extra padding for fixed bottom button
    },
    backButton: {
        marginBottom: 16,
    },
    headerContainer: {
        paddingBottom: 32,
        paddingTop: 4,
    },
    title: {
        fontWeight: "600",
    },
    contentContainer: {
        gap: 32,
    },
    categorySection: {
        gap: 8,
    },
    workspaceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
    },
    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        width: "100%",
    },
    tasksList: {
        gap: 12,
    },
    taskItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        position: "relative",
    },
    taskContent: {
        flex: 1,
        lineHeight: 23,
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        position: "absolute",
        right: 10,
        top: "50%",
        marginTop: -5,
    },
    taskNumber: {
        position: "absolute",
        right: 25,
        top: "50%",
        marginTop: -9,
        fontSize: 12,
    },
    bottomButtonContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 16,
        paddingBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 5,
    },
});

