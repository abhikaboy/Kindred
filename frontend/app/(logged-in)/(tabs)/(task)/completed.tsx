import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import React, { useRef, useState, useEffect, useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useDrawer } from "@/contexts/drawerContext";
import { getCompletedTasksAPI, PaginatedCompletedTasksResponse } from "@/api/task";
import TaskCard from "@/components/cards/TaskCard";
import { useTasks } from "@/contexts/tasksContext";

const TASKS_PER_PAGE = 20;

// Type for TaskDocument with completion fields
type CompletedTask = {
    id: string;
    content: string;
    categoryID: string;
    value: number;
    timeCompleted?: string;
    [key: string]: any;
};

// Helper function to format dates for section headers
const formatSectionDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset hours for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    if (compareDate.getTime() === today.getTime()) {
        return "Today";
    } else if (compareDate.getTime() === yesterday.getTime()) {
        return "Yesterday";
    } else {
        // Format as "Monday, January 15, 2024"
        return date.toLocaleDateString("en-US", { 
            weekday: "long", 
            year: "numeric", 
            month: "long", 
            day: "numeric" 
        });
    }
};

// Helper function to group tasks by date
const groupTasksByDate = (tasks: CompletedTask[] | undefined) => {
    // Handle undefined or null tasks array
    if (!tasks || !Array.isArray(tasks)) {
        console.warn("groupTasksByDate received invalid tasks:", tasks);
        return [];
    }
    
    const grouped: { [key: string]: CompletedTask[] } = {};
    
    tasks.forEach(task => {
        if (task?.timeCompleted) {
            try {
                const date = new Date(task.timeCompleted);
                const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                
                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(task);
            } catch (err) {
                console.error("Error parsing date for task:", task, err);
            }
        }
    });
    
    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    
    return sortedDates.map(dateKey => ({
        date: new Date(dateKey),
        dateKey,
        tasks: grouped[dateKey]
    }));
};

const CompletedTasks = () => {
    const ThemedColor = useThemeColor();
    const drawerRef = useRef(null);
    const { setIsDrawerOpen } = useDrawer();
    const { categories } = useTasks();
    
    const [paginationData, setPaginationData] = useState<PaginatedCompletedTasksResponse>({
        tasks: [],
        page: 1,
        limit: TASKS_PER_PAGE,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Fetch completed tasks with pagination
    const fetchCompletedTasks = async (page: number) => {
        try {
            setLoading(true);
            setError(null);
            console.log(`Fetching completed tasks for page ${page}`);
            const response = await getCompletedTasksAPI(page, TASKS_PER_PAGE);
            console.log("API Response:", response);
            
            // Validate response structure
            if (!response) {
                throw new Error("No response received from API");
            }
            
            // Ensure tasks is an array
            const validatedResponse: PaginatedCompletedTasksResponse = {
                tasks: Array.isArray(response.tasks) ? response.tasks : [],
                page: response.page || page,
                limit: response.limit || TASKS_PER_PAGE,
                total: response.total || 0,
                totalPages: response.totalPages || 0,
            };
            
            console.log("Validated response:", validatedResponse);
            setPaginationData(validatedResponse);
        } catch (err) {
            console.error("Error fetching completed tasks:", err);
            setError(err instanceof Error ? err.message : "Failed to load completed tasks");
            // Set empty state on error
            setPaginationData({
                tasks: [],
                page: page,
                limit: TASKS_PER_PAGE,
                total: 0,
                totalPages: 0,
            });
        } finally {
            setLoading(false);
        }
    };
    
    // Fetch tasks when page changes
    useEffect(() => {
        fetchCompletedTasks(paginationData.page);
    }, [paginationData.page]);
    
    // Group tasks by date
    const groupedTasks = useMemo(() => groupTasksByDate(paginationData.tasks as CompletedTask[]), [paginationData.tasks]);
    
    const handleNextPage = () => {
        if (paginationData.page < paginationData.totalPages) {
            setPaginationData(prev => ({ ...prev, page: prev.page + 1 }));
        }
    };
    
    const handlePreviousPage = () => {
        if (paginationData.page > 1) {
            setPaginationData(prev => ({ ...prev, page: prev.page - 1 }));
        }
    };
    
    const getCategoryName = (categoryId: string) => {
        const category = categories?.find(cat => cat.id === categoryId);
        return category?.name || "Unknown";
    };

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        Completed Tasks
                    </ThemedText>
                    <ThemedText type="lightBody" style={styles.subtitle}>
                        View all your completed tasks organized by date
                    </ThemedText>
                </View>
                
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={ThemedColor.primary} />
                        <ThemedText type="lightBody" style={{ marginTop: 16 }}>
                            Loading completed tasks...
                        </ThemedText>
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Feather name="alert-circle" size={48} color={ThemedColor.error} />
                        <ThemedText type="lightBody" style={{ marginTop: 16, color: ThemedColor.error }}>
                            {error}
                        </ThemedText>
                    </View>
                ) : paginationData.total === 0 ? (
                    <View style={styles.centerContainer}>
                        <Feather name="check-circle" size={48} color={ThemedColor.caption} />
                        <ThemedText type="lightBody" style={{ marginTop: 16, textAlign: "center" }}>
                            No completed tasks yet.{"\n"}Complete tasks to see them here!
                        </ThemedText>
                    </View>
                ) : (
                    <>
                        <ScrollView 
                            style={styles.scrollView} 
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}>
                            {groupedTasks.map(({ date, dateKey, tasks }) => (
                                <View key={dateKey} style={styles.dateSection}>
                                    <View style={styles.dateSectionHeader}>
                                        <ThemedText type="subtitle" style={styles.dateText}>
                                            {formatSectionDate(date)}
                                        </ThemedText>
                                        <ThemedText type="caption" style={styles.taskCount}>
                                            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                                        </ThemedText>
                                    </View>
                                    
                                    <View style={styles.tasksContainer}>
                                        {tasks.map((task) => (
                                            <View key={task.id} style={styles.taskCardWrapper}>
                                                <TaskCard
                                                    redirect={true}
                                                    categoryId={task.categoryID}
                                                    content={task.content}
                                                    value={task.value}
                                                    priority={1}
                                                    id={task.id}
                                                    task={task as any}
                                                />
                                                {task.timeCompleted && (
                                                    <View style={styles.completionTimeContainer}>
                                                        <Feather 
                                                            name="check-circle" 
                                                            size={12} 
                                                            color={ThemedColor.success} 
                                                        />
                                                        <ThemedText type="caption" style={styles.completionTime}>
                                                            Completed at {new Date(task.timeCompleted).toLocaleTimeString("en-US", {
                                                                hour: "numeric",
                                                                minute: "2-digit",
                                                                hour12: true
                                                            })}
                                                        </ThemedText>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        
                        {/* Pagination Controls */}
                        {paginationData.totalPages > 1 && (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity 
                                    onPress={handlePreviousPage}
                                    disabled={paginationData.page === 1}
                                    style={[
                                        styles.paginationButton,
                                        paginationData.page === 1 && styles.paginationButtonDisabled
                                    ]}>
                                    <Feather 
                                        name="chevron-left" 
                                        size={20} 
                                        color={paginationData.page === 1 ? ThemedColor.caption : ThemedColor.text} 
                                    />
                                    <ThemedText 
                                        type="default" 
                                        style={[
                                            styles.paginationButtonText,
                                            paginationData.page === 1 && { color: ThemedColor.caption }
                                        ]}>
                                        Previous
                                    </ThemedText>
                                </TouchableOpacity>
                                
                                <View style={styles.paginationInfo}>
                                    <ThemedText type="default" style={styles.paginationText}>
                                        Page {paginationData.page} of {paginationData.totalPages}
                                    </ThemedText>
                                    <ThemedText type="caption" style={styles.paginationSubtext}>
                                        Showing {paginationData.tasks.length} of {paginationData.total} tasks
                                    </ThemedText>
                                </View>
                                
                                <TouchableOpacity 
                                    onPress={handleNextPage}
                                    disabled={paginationData.page === paginationData.totalPages}
                                    style={[
                                        styles.paginationButton,
                                        paginationData.page === paginationData.totalPages && styles.paginationButtonDisabled
                                    ]}>
                                    <ThemedText 
                                        type="default" 
                                        style={[
                                            styles.paginationButtonText,
                                            paginationData.page === paginationData.totalPages && { color: ThemedColor.caption }
                                        ]}>
                                        Next
                                    </ThemedText>
                                    <Feather 
                                        name="chevron-right" 
                                        size={20} 
                                        color={paginationData.page === paginationData.totalPages ? ThemedColor.caption : ThemedColor.text} 
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </ThemedView>
        </DrawerLayout>
    );
};

export default CompletedTasks;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: Dimensions.get("screen").height * 0.02,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
    subtitle: {
        lineHeight: 24,
        marginTop: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
        gap: 32,
    },
    dateSection: {
        gap: 16,
    },
    dateSectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 8,
    },
    dateText: {
        fontWeight: "600",
    },
    taskCount: {
        fontSize: 14,
    },
    tasksContainer: {
        gap: 16,
    },
    taskCardWrapper: {
        gap: 8,
    },
    completionTimeContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 4,
    },
    completionTime: {
        fontSize: 12,
    },
    paginationContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 16,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: "rgba(0, 0, 0, 0.1)",
    },
    paginationButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    paginationButtonDisabled: {
        opacity: 0.5,
    },
    paginationButtonText: {
        fontSize: 14,
    },
    paginationInfo: {
        alignItems: "center",
        gap: 4,
    },
    paginationText: {
        fontSize: 14,
        fontWeight: "600",
    },
    paginationSubtext: {
        fontSize: 12,
    },
});

