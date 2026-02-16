import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskTabs from "@/components/inputs/TaskTabs";
import { ErrorBoundaryProps, useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import DataCard from "@/components/task/DataCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import ConditionalView from "@/components/ui/ConditionalView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useDebounce } from "@/hooks/useDebounce";
import { updateNotesAPI, updateChecklistAPI, getTemplateByIDAPI, removeFromCategoryAPI } from "@/api/task";
import Checklist from "@/components/task/Checklist";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";
import { RecurDetails } from "@/api/types";
import { Note, ListChecks, Calendar, Flag, Repeat, Bell, PencilSimple, Plugs, Trash } from "phosphor-react-native";
import { getIntegrationIcon, getIntegrationName, openIntegrationApp } from "@/utils/integrationUtils";
import PagerView from "react-native-pager-view";
import type { components } from "@/api/generated/types";
import { Screen } from "@/components/modals/CreateModal";
import { useCreateModal } from "@/contexts/createModalContext";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DeadlineBottomSheetModal from "@/components/modals/DeadlineBottomSheetModal";
import { Picker } from "@react-native-picker/picker";
import { useTaskCompletion } from "@/hooks/useTaskCompletion";
import RecurringInfoCard from "@/components/task/RecurringInfoCard";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { logger } from "@/utils/logger";

type TemplateTaskDocument = components["schemas"]["TemplateTaskDocument"];

export const unstable_settings = {
    initialRouteName: "index",
};

export default function Task() {
    const [activeTab, setActiveTab] = useState(0);
    const { name, id, categoryId } = useLocalSearchParams();
    let ThemedColor = useThemeColor();
    const { getTaskById, updateTask, removeFromCategory } = useTasks();
    const { loadTaskData } = useTaskCreation();
    const { openModal, visible: modalVisible, modalConfig } = useCreateModal();
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(new Date());
    const [baseTime, setBaseTime] = useState(new Date());
    const [localNotes, setLocalNotes] = useState("");
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [hasTemplate, setHasTemplate] = useState(false);
    const [template, setTemplate] = useState<TemplateTaskDocument | null>(null);
    const [recurDetails, setRecurDetails] = useState<RecurDetails | null>(null);

    // Query task from local context instead of relying on passed state
    const task = getTaskById(categoryId as string, id as string);

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    // Add a ref to track mounted state
    const isMounted = useRef(true);
    const scrollViewRef = useRef<ScrollView>(null);
    const pagerViewRef = useRef<PagerView>(null);
    const isLoadingTaskData = useRef(false);
    const hasLoadedTaskDataForModal = useRef(false);

    const safeAsync = useSafeAsync();

    // Task completion hook
    const { markTaskAsCompleted, isCompleting } = useTaskCompletion({
        onSuccess: () => {
            // Navigate back after completion
            router.back();
        },
    });

    // Function to refresh task data after edit
    const refreshTaskData = () => {
        // This will trigger a re-render with updated task data
        // The task context should automatically update when the task is modified
    };

    // Handle deadline update
    const handleDeadlineUpdate = (deadline: Date | null) => {
        logger.debug("Deadline updated", { deadline });

        // Update the local task state immediately for UI responsiveness
        if (task && categoryId && id) {
            updateTask(categoryId as string, id as string, {
                deadline: deadline?.toISOString() || "",
            });
        }
    };

    const handleIntegrationPress = async () => {
        const result = await openIntegrationApp(task?.integration);
        if (!result.success) {
            setAlertTitle(result.title || "Error");
            setAlertMessage(result.message || "Failed to open integration");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        }
    };

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const formatElapsedTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    const loadBaseTime = async (id) => {
        const { result, error } = await safeAsync(async () => {
            const [storedTime, isRunning] = await Promise.all([
                AsyncStorage.getItem(`task_${id}_baseTime`),
                AsyncStorage.getItem(`task_${id}_isRunning`),
            ]);

            if (storedTime) {
                setBaseTime(new Date(parseInt(storedTime)));
                setIsRunning(isRunning === "true");
            }
        });

        if (error) {
            logger.error("Error loading base time", error);
        }
    };

    const saveBaseTime = async (time: Date) => {
        try {
            await AsyncStorage.setItem(`task_${id}_baseTime`, time.getTime().toString());
        } catch (error) {
            logger.error("Error saving base time", error);
        }
    };

    // useSafeAsync(async () => {
    //     await loadBaseTime(id as string);
    // }, [id]);

    const getTemplate = async (id: string) => {
        const template = await getTemplateByIDAPI(id);
        logger.debug("Template fetched", { template });
        setTemplate(template);
        setRecurDetails(template?.recurDetails as RecurDetails);
    };

    useEffect(() => {
        logger.debug("Task data updated", { task });
        if (task?.templateID != null) {
            setHasTemplate(true);
            getTemplate(task.templateID);
            // make a request to the server to get the template
        } else {
            setHasTemplate(false);
            setRecurDetails(null);
            setTemplate(null);
        }
        // Update local notes when task data loads
        if (task?.notes !== undefined) {
            setLocalNotes(task.notes);
        }
    }, [task?.templateID, task?.notes, task?.id]);

    // TEMPORARILY DISABLED - Testing if this is causing the issue
    // Load task data when modal opens for editing
    // useEffect(() => {
    //     if (modalVisible && modalConfig.edit && task && modalConfig.categoryId === categoryId) {
    //         if (!hasLoadedTaskDataForModal.current) {
    //             logger.debug("Loading task data for edit modal");
    //             loadTaskData(task);
    //             hasLoadedTaskDataForModal.current = true;
    //         }
    //     } else if (!modalVisible) {
    //         // Reset flag when modal closes
    //         hasLoadedTaskDataForModal.current = false;
    //     }
    // }, [modalVisible, modalConfig.edit, modalConfig.categoryId, task?.id, categoryId, loadTaskData]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isRunning && isMounted.current) {
            interval = setInterval(() => {
                if (isMounted.current) {
                    setTime(new Date());
                }
            }, 1000) as unknown as NodeJS.Timeout;
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isRunning]);

    const startTimer = async (id) => {
        try {
            await Promise.all([
                AsyncStorage.setItem(`task_${id}_isRunning`, "true"),
                AsyncStorage.setItem(`task_${id}_baseTime`, new Date().getTime().toString()),
            ]);
            if (isMounted.current) {
                setIsRunning(true);
                setBaseTime(new Date());
            }
        } catch (error) {
            logger.error("Error starting timer", error);
        }
    };

    const restartTimer = (id) => {
        setIsRunning(true);
        setBaseTime(new Date());
        saveBaseTime(new Date());
        AsyncStorage.setItem(`task_${id}_isRunning`, "true");
    };

    const pauseTimer = async (id) => {
        try {
            await AsyncStorage.setItem(`task_${id}_isRunning`, "false");
            if (isMounted.current) {
                setIsRunning(false);
            }
        } catch (error) {
            logger.error("Error pausing timer", error);
        }
    };

    const stopTimer = (id) => {
        setIsRunning(false);
        setBaseTime(new Date());
        saveBaseTime(new Date());
        AsyncStorage.setItem(`task_${id}_isRunning`, "false");
    };

    const toggleTimer = (id) => {
        if (isRunning) {
            pauseTimer(id);
        } else {
            startTimer(id);
        }
    };

    const router = useRouter();

    logger.debug("Current task state", { task, categoryId, id });

    // If task is not found, show error state
    if (!task && categoryId && id) {
        return (
            <ThemedView
                style={{
                    flex: 1,
                    paddingHorizontal: HORIZONTAL_PADDING,
                    paddingTop: Dimensions.get("screen").height * 0.07,
                    justifyContent: "center",
                    alignItems: "center",
                }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        position: "absolute",
                        top: Dimensions.get("screen").height * 0.07,
                        left: HORIZONTAL_PADDING,
                        paddingVertical: 16,
                        zIndex: 1000,
                    }}>
                    <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <Ionicons name="alert-circle-outline" size={64} color={ThemedColor.caption} />
                <ThemedText type="subtitle" style={{ marginTop: 16, textAlign: "center" }}>
                    Task Not Found
                </ThemedText>
                <ThemedText type="lightBody" style={{ marginTop: 8, textAlign: "center", color: ThemedColor.caption }}>
                    This task may have been deleted or moved.
                </ThemedText>
                <PrimaryButton
                    title="Go Back"
                    onPress={() => router.back()}
                    style={{ marginTop: 24, minWidth: 200 }}
                />
            </ThemedView>
        );
    }
    const updateNotes = useDebounce(async (notes: string) => {
        if (task && categoryId && id) {
            try {
                await updateNotesAPI(categoryId as string, id as string, notes);
                // Update the task in context so it persists when navigating away
                updateTask(categoryId as string, id as string, { notes });
            } catch (error) {
                logger.error("Error updating notes", error);
            }
        }
    }, 2000);

    const handleScroll = (event: any) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        // Adjust this threshold based on when you want the header to become sticky
        const stickyThreshold = 120; // Adjust this value as needed
        setIsHeaderSticky(scrollY > stickyThreshold);
    };

    const handleTabChange = (index: number) => {
        setActiveTab(index);
        pagerViewRef.current?.setPage(index);
    };

    const handleMarkAsCompleted = () => {
        if (task && categoryId && id) {
            markTaskAsCompleted(categoryId as string, id as string, {
                id: task.id,
                content: task.content,
                value: task.value,
                public: task.public,
            });
        }
    };

    const handleDelete = async () => {
        if (!task || !categoryId || !id) return;

        const deleteAction = async (deleteRecurring: boolean = false) => {
            try {
                await removeFromCategoryAPI(categoryId as string, id as string, deleteRecurring);
                removeFromCategory(categoryId as string, id as string);
                router.back();
            } catch (error) {
                logger.error("Error deleting task", error);
                showToastable({
                    title: "Error",
                    status: "danger",
                    position: "top",
                    message: "Error deleting task",
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        };

        if (task.templateID) {
            setAlertTitle("Delete Recurring Task");
            setAlertMessage("Do you want to delete only this task or all future tasks?");
            setAlertButtons([
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Only This Task",
                    onPress: () => deleteAction(false),
                },
                {
                    text: "All Future Tasks",
                    onPress: () => deleteAction(true),
                    style: "destructive",
                },
            ]);
            setAlertVisible(true);
        } else {
            setAlertTitle("Delete Task");
            setAlertMessage("Are you sure you want to delete this task?");
            setAlertButtons([
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    onPress: () => deleteAction(false),
                    style: "destructive",
                },
            ]);
            setAlertVisible(true);
        }
    };

    const handleEditPress = useCallback(() => {
        console.log("🔵 SIMPLE handleEditPress - just opening modal");
        openModal({
            edit: true,
            categoryId: categoryId as string,
            screen: Screen.STANDARD,
        });
    }, [categoryId, openModal]);

    const handleDeadlineModalPress = useCallback(() => {
        if (!task || isLoadingTaskData.current || !isMounted.current) return;

        isLoadingTaskData.current = true;

        try {
            loadTaskData(task);
            setShowDeadlineModal(true);
        } finally {
            isLoadingTaskData.current = false;
        }
    }, [task?.id, loadTaskData]); // Only depend on task.id, not the whole object

    return (
        <ThemedView
            style={{
                flex: 1,
                paddingHorizontal: HORIZONTAL_PADDING,
                position: "relative",
                paddingTop: Dimensions.get("screen").height * 0.07,
            }}>
            {/* Sticky Header - Only shows when scrolled */}
            <ConditionalView condition={isHeaderSticky}>
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: ThemedColor.background,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        paddingTop: Dimensions.get("screen").height * 0.07,
                        paddingBottom: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: ThemedColor.lightened,
                    }}>
                </View>
            </ConditionalView>

            {/* Header Section - Always visible */}
            <View style={{ paddingBottom: 16 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        zIndex: 1000,
                        paddingVertical: 16,
                        left: 0,
                    }}>
                    <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "space-between",
                    }}>
                    <ThemedText type="title" style={{ flexWrap: "wrap", width: "80%" }}>
                        {name}
                        {isRunning ? <MaterialIcons name="timer" size={24} color={ThemedColor.text} /> : ""}
                    </ThemedText>
                    <TouchableOpacity onPress={handleEditPress}>
                        <PencilSimple size={24} color={ThemedColor.text} weight="regular" />
                    </TouchableOpacity>
                </View>
                <View style={{ paddingBottom: 16 }} />
                {/* <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={handleTabChange} /> */}
            </View>

            {/* PagerView Content */}
            <PagerView
                ref={pagerViewRef}
                style={{ flex: 1 }}
                initialPage={activeTab}
                onPageSelected={(e) => setActiveTab(e.nativeEvent.position)}
                scrollEnabled={true}>
                {/* Details Tab */}
                <View key="0" style={{ flex: 1 }}>
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 128 }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
                            <View style={{ gap: 20 }}>
                                <DataCard
                                    title="Notes"
                                    key="notes"
                                    icon={<Note size={20} color={ThemedColor.text} weight="regular" />}
                                >
                                    <TextInput
                                        value={localNotes}
                                        onChangeText={(text) => {
                                            // Update local state immediately for UI responsiveness
                                            setLocalNotes(text);
                                            // Debounced API call
                                            updateNotes(text);
                                        }}
                                        multiline={true}
                                        placeholder="Tap to add notes"
                                        style={{
                                            paddingVertical: 8,
                                            fontSize: 16,
                                            color: ThemedColor.text,
                                            fontFamily: "OutfitLight",
                                        }}
                                    />
                                </DataCard>
                                <DataCard
                                    title="Checklist"
                                    key="checklist"
                                    icon={<ListChecks size={20} color={ThemedColor.text} weight="regular" />}
                                >
                                    <Checklist
                                        initialChecklist={
                                            task?.checklist?.map((item, index) => ({
                                                id: item.id,
                                                content: item.content,
                                                completed: item.completed,
                                                order: index, // Add order based on array index
                                            })) || []
                                        }
                                        categoryId={categoryId as string}
                                        taskId={id as string}
                                        autoSave={true}
                                        onChecklistChange={(checklist) => {
                                            // Update local task state for immediate UI feedback
                                            if (task && categoryId && id) {
                                                task.checklist = checklist.map((item) => ({
                                                    id: item.id || "",
                                                    content: item.content,
                                                    completed: item.completed,
                                                    order: item.order,
                                                }));

                                                // ✅ FIX: Update task context to invalidate cache
                                                updateTask(categoryId as string, id as string, {
                                                    checklist: task.checklist
                                                });
                                            }
                                        }}
                                    />
                                </DataCard>
                                <ConditionalView condition={task?.startDate != null} key="startDate">
                                    <DataCard
                                        title="Start Date"
                                        icon={<Calendar size={20} color={ThemedColor.text} weight="regular" />}
                                    >
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                justifyContent: "space-between",
                                            }}>
                                            <ThemedText type="lightBody">
                                                {new Date(task?.startDate).toLocaleDateString()}
                                            </ThemedText>
                                            <ThemedText type="lightBody">
                                                {task?.startTime
                                                    ? new Date(task?.startTime).toLocaleTimeString()
                                                    : "No Start Time"}
                                            </ThemedText>
                                        </View>
                                    </DataCard>
                                </ConditionalView>
                                <ConditionalView condition={task?.deadline != null} key="deadline">
                                    <DataCard
                                        title="Deadline"
                                        icon={<Flag size={20} color={ThemedColor.text} weight="regular" />}
                                    >
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}>
                                            <View style={{ flexDirection: "column" }}>
                                                <ThemedText type="lightBody">
                                                    {new Date(task?.deadline).toLocaleDateString()}
                                                </ThemedText>
                                                <ThemedText type="lightBody">
                                                    {task?.deadline
                                                        ? new Date(task?.deadline).toLocaleTimeString()
                                                        : "No Deadline Time"}
                                                </ThemedText>
                                            </View>
                                            <TouchableOpacity
                                                onPress={handleDeadlineModalPress}
                                                style={{
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: ThemedColor.lightened,
                                                }}>
                                                <PencilSimple size={16} color={ThemedColor.text} weight="regular" />
                                            </TouchableOpacity>
                                        </View>
                                    </DataCard>
                                </ConditionalView>
                                <ConditionalView condition={recurDetails != null} key="recurring">
                                    <RecurringInfoCard
                                        recurDetails={recurDetails!}
                                        frequency={template?.recurFrequency}
                                        recurType={template?.recurType}
                                        lastDate={template?.lastGenerated}
                                        nextDate={template?.nextGenerated}
                                    />
                                </ConditionalView>
                                <ConditionalView condition={task?.reminders != null} key="reminders">
                                    <DataCard
                                        title="Reminders"
                                        icon={<Bell size={20} color={ThemedColor.text} weight="regular" />}
                                    >
                                        {task?.reminders?.map((reminder) => (
                                            <View key={reminder.triggerTime.toString()}>
                                                <ThemedText type="lightBody">
                                                    {new Date(reminder.triggerTime).toLocaleString()}
                                                </ThemedText>
                                            </View>
                                        ))}
                                    </DataCard>
                                </ConditionalView>
                                <ConditionalView condition={task?.integration != null} key="integration">
                                    <TouchableOpacity
                                        onPress={handleIntegrationPress}
                                        activeOpacity={0.7}
                                    >
                                        <DataCard
                                            title="Integration"
                                            icon={<Plugs size={20} color={ThemedColor.text} weight="regular" />}
                                        >
                                            <View style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 12,
                                                paddingVertical: 8,
                                            }}>
                                                {getIntegrationIcon(task?.integration, ThemedColor.primary, 28)}
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                                                        {getIntegrationName(task?.integration)}
                                                    </ThemedText>
                                                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption, fontSize: 13 }}>
                                                        Tap to open
                                                    </ThemedText>
                                                </View>
                                            </View>
                                        </DataCard>
                                    </TouchableOpacity>
                                </ConditionalView>
                                <View key="mark-complete" style={{ marginTop: 0 }}>
                                    <PrimaryButton
                                        title={isCompleting ? "Completing..." : "Mark as Completed"}
                                        outline
                                        style={{
                                            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
                                        }}
                                        onPress={handleMarkAsCompleted}
                                        disabled={isCompleting}
                                    />
                                </View>
                                <ConditionalView condition={task?.deadline == null} key="deadline-2">
                                    <PrimaryButton
                                        title="Set Deadline"
                                        style={{
                                            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
                                        }}
                                        onPress={handleDeadlineModalPress}
                                    />
                                </ConditionalView>
                            </View>
                        </KeyboardAvoidingView>
                    </ScrollView>
                </View>

                {/* Timer Tab */}
                {/* <View key="1">
                    <View
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 8,
                            alignItems: "center",
                            borderColor: ThemedColor.border,
                            borderRadius: 12,
                            padding: 2,
                        }}>
                        <Picker selectedValue={hours} style={{ flex: 1 }} onValueChange={setHours}>
                            {Array.from({ length: 59 }, (_, i) => (
                                <Picker.Item key={i + 1} label={`${i + 1} hours`} value={i + 1} />
                            ))}
                        </Picker>
                        <Picker selectedValue={minutes} style={{ flex: 1 }} onValueChange={setMinutes}>
                            {Array.from({ length: 59 }, (_, i) => (
                                <Picker.Item key={i + 1} label={`${i + 1} minutes`} value={i + 1} />
                            ))}
                        </Picker>
                    </View>
                    <View>
                        <PrimaryButton
                            title="Set Timer"
                            onPress={() => {
                                logger.debug("Timer set", { hours, minutes });
                            }}
                        />
                    </View>
                </View> */}
            </PagerView>

            {showDeadlineModal && (
                <DeadlineBottomSheetModal
                    visible={showDeadlineModal}
                    setVisible={setShowDeadlineModal}
                    taskId={id as string}
                    categoryId={categoryId as string}
                    onDeadlineUpdate={handleDeadlineUpdate}
                />
            )}

            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title={alertTitle}
                    message={alertMessage}
                    buttons={alertButtons}
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({});

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </View>
    );
}
