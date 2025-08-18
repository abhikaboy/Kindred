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
import React, { useState, useEffect, useRef } from "react";
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
import { updateNotesAPI, updateChecklistAPI, getTemplateByIDAPI } from "@/api/task";
import Checklist from "@/components/task/Checklist";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";
import { RecurDetails } from "@/api/types";
import Feather from "@expo/vector-icons/Feather";
import PagerView from "react-native-pager-view";
import type { components } from "@/api/generated/types";
import CreateModal, { Screen } from "@/components/modals/CreateModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DeadlineBottomSheetModal from "@/components/modals/DeadlineBottomSheetModal";

type TemplateTaskDocument = components["schemas"]["TemplateTaskDocument"];

export const unstable_settings = {
    initialRouteName: "index",
};

export default function Task() {
    const [activeTab, setActiveTab] = useState(0);
    const { name, id, categoryId } = useLocalSearchParams();
    let ThemedColor = useThemeColor();
    const { task } = useTasks();
    const { loadTaskData } = useTaskCreation();
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(new Date());
    const [baseTime, setBaseTime] = useState(new Date());
    const [localNotes, setLocalNotes] = useState("");
    const [isHeaderSticky, setIsHeaderSticky] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeadlineModal, setShowDeadlineModal] = useState(false);

    const [hasTemplate, setHasTemplate] = useState(false);
    const [template, setTemplate] = useState<TemplateTaskDocument | null>(null);
    const [recurDetails, setRecurDetails] = useState<RecurDetails | null>(null);

    // Add a ref to track mounted state
    const isMounted = useRef(true);
    const scrollViewRef = useRef<ScrollView>(null);
    const pagerViewRef = useRef<PagerView>(null);

    const safeAsync = useSafeAsync();

    // Function to refresh task data after edit
    const refreshTaskData = () => {
        // This will trigger a re-render with updated task data
        // The task context should automatically update when the task is modified
    };

    // Handle deadline update
    const handleDeadlineUpdate = (deadline: Date | null) => {
        console.log("Deadline updated:", deadline);
        // The task context should automatically update when the task is modified
        // You can add additional logic here if needed
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
            console.error("Error loading base time:", error);
        }
    };

    const saveBaseTime = async (time: Date) => {
        try {
            await AsyncStorage.setItem(`task_${id}_baseTime`, time.getTime().toString());
        } catch (error) {
            console.error("Error saving base time:", error);
        }
    };

    // useSafeAsync(async () => {
    //     await loadBaseTime(id as string);
    // }, [id]);

    const getTemplate = async (id: string) => {
        const template = await getTemplateByIDAPI(id);
        console.log(template);
        setTemplate(template);
        setRecurDetails(template?.recurDetails);
    };

    useEffect(() => {
        console.log(task);
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
    }, [task]);

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
            console.error("Error starting timer:", error);
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
            console.error("Error pausing timer:", error);
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

    console.log(task);
    const updateNotes = useDebounce(async (notes: string) => {
        if (task && categoryId && id) {
            await updateNotesAPI(categoryId as string, id as string, notes);
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
                    <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={handleTabChange} />
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
                    <TouchableOpacity
                        onPress={() => {
                            // Load task data into the context and open edit modal
                            if (task) {
                                console.log("task", task);
                                loadTaskData(task);
                                setShowEditModal(true);
                            }
                        }}>
                        <Feather name="edit" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                </View>
                <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={handleTabChange} />
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
                        contentContainerStyle={{ paddingBottom: 50 }}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
                            <View style={{ gap: 20 }}>
                                <DataCard title="Notes" key="notes">
                                    <TextInput
                                        value={localNotes}
                                        onChangeText={(text) => {
                                            // Update local state immediately for UI responsiveness
                                            setLocalNotes(text);
                                            // Debounced API call
                                            updateNotes(text);
                                        }}
                                        placeholder="Tap to add notes"
                                        style={{
                                            backgroundColor: ThemedColor.lightened,
                                            paddingVertical: 8,
                                            fontSize: 16,
                                            color: ThemedColor.text,
                                            fontFamily: "OutfitLight",
                                        }}
                                    />
                                </DataCard>
                                <DataCard title="Checklist" key="checklist">
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
                                            if (task) {
                                                task.checklist = checklist.map((item) => ({
                                                    id: item.id || "",
                                                    content: item.content,
                                                    completed: item.completed,
                                                    order: item.order,
                                                }));
                                            }
                                        }}
                                    />
                                </DataCard>
                                <ConditionalView condition={task?.startDate != null} key="startDate">
                                    <DataCard title="Start Date">
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
                                    <DataCard title="Deadline">
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
                                                onPress={() => setShowDeadlineModal(true)}
                                                style={{
                                                    padding: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: ThemedColor.lightened,
                                                }}>
                                                <Feather name="edit-2" size={16} color={ThemedColor.text} />
                                            </TouchableOpacity>
                                        </View>
                                    </DataCard>
                                </ConditionalView>
                                <ConditionalView condition={task?.deadline == null} key="deadline-2">
                                    <PrimaryButton
                                        title="Set Deadline"
                                        outline
                                        style={{
                                            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
                                        }}
                                        onPress={() => {
                                            setShowDeadlineModal(true);
                                        }}
                                    />
                                </ConditionalView>
                                <ConditionalView condition={recurDetails != null} key="recurring">
                                    <DataCard title="Recurring">
                                        <View style={{ flexDirection: "column", gap: 8 }}>
                                            <ThemedText type="lightBody">
                                                {DetailsToString(
                                                    recurDetails,
                                                    template?.recurFrequency,
                                                    template?.recurType
                                                )}
                                            </ThemedText>
                                            <ThemedText type="lightBody">
                                                {template?.recurType === "OCCURRENCE"
                                                    ? "Repeating Start Date"
                                                    : "Repeating Deadline"}
                                            </ThemedText>
                                        </View>
                                    </DataCard>
                                </ConditionalView>
                                <ConditionalView condition={task?.reminders != null} key="reminders">
                                    <DataCard title="Reminders">
                                        {task?.reminders?.map((reminder) => (
                                            <View key={reminder.triggerTime.toString()}>
                                                <ThemedText type="lightBody">
                                                    {new Date(reminder.triggerTime).toLocaleString()}
                                                </ThemedText>
                                            </View>
                                        ))}
                                    </DataCard>
                                </ConditionalView>
                            </View>
                        </KeyboardAvoidingView>
                    </ScrollView>
                </View>

                {/* Timer Tab */}
                <View key="1" style={{ flex: 1 }}>
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 50 }}
                        scrollEventThrottle={16}>
                        <TouchableOpacity
                            style={{
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 16,
                                marginTop: Dimensions.get("screen").height * 0.05,
                            }}
                            onPress={toggleTimer}>
                            <View
                                style={{
                                    borderWidth: 16,
                                    borderColor: isRunning ? "#CBFFDD" : "#FFB8B8",
                                    borderRadius: 2000,
                                    width: Dimensions.get("screen").width * 0.8,
                                    height: Dimensions.get("screen").width * 0.8,
                                    justifyContent: "center",
                                    alignItems: "center",
                                }}>
                                <View
                                    style={{
                                        display: "flex",
                                        width: Dimensions.get("screen").width * 0.8,
                                        height: Dimensions.get("screen").width * 0.8,
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        borderColor: isRunning ? "#00C49F" : "#FF5C5F",
                                        borderWidth: 6,
                                        borderRadius: 2000,
                                    }}>
                                    <ThemedText type="heading">
                                        {formatElapsedTime(new Date().getTime() - baseTime.getTime())}
                                    </ThemedText>
                                </View>
                            </View>
                        </TouchableOpacity>
                        <ConditionalView condition={!isRunning}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "center",
                                    width: "100%",
                                    marginTop: 24,
                                }}>
                                <ThemedText type="lightBody">Tap the stopwatch to begin</ThemedText>
                            </View>
                        </ConditionalView>
                        <ConditionalView condition={isRunning}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "center",
                                    width: "100%",
                                    marginTop: 24,
                                }}>
                                {/* <TouchableOpacity onPress={() => pauseTimer()}>
                                    <MaterialIcons name="pause" size={48} color={ThemedColor.text} />
                                </TouchableOpacity> */}
                                <TouchableOpacity onPress={() => restartTimer(id)}>
                                    <MaterialIcons name="restart-alt" size={48} color={ThemedColor.text} />
                                </TouchableOpacity>
                                {/* <TouchableOpacity onPress={() => stopTimer()}>
                                    <MaterialIcons name="stop" size={48} color={ThemedColor.text} />
                                </TouchableOpacity> */}
                            </View>
                        </ConditionalView>
                    </ScrollView>
                </View>
            </PagerView>
            
            <CreateModal
                visible={showEditModal}
                setVisible={setShowEditModal}
                edit={true}
                categoryId={categoryId as string}
                screen={Screen.DEADLINE}
            />
            
            <DeadlineBottomSheetModal
                visible={showDeadlineModal}
                setVisible={setShowDeadlineModal}
                taskId={id as string}
                categoryId={categoryId as string}
                onDeadlineUpdate={handleDeadlineUpdate}
            />
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

function DetailsToString(details: RecurDetails, frequency: string, type: string) {
    let caseMap = new Map<string, string>([
        ["[0,1,1,1,1,1,0]", "Weekdays"],
        ["[0,0,0,0,0,0,1]", "Weekends"],
        ["[1,1,1,1,1,1,1]", "Every day of the week"],
    ]);

    let daysOfWeekMapping = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let arrayToDays = (array: number[]) => {
        let numEntries = array.filter((day) => day === 1).length;
        if (numEntries == 1) {
            return daysOfWeekMapping[array.findIndex((day) => day === 1)];
        }
        if (numEntries == 2) {
            return (
                daysOfWeekMapping[array.findIndex((day) => day === 1)] +
                " and " +
                daysOfWeekMapping[array.findLastIndex((day) => day === 1)]
            );
        }
        return array.map((day, index) => {
            if (day === 1) {
                return daysOfWeekMapping[index];
            }
        });
    };
    switch (frequency) {
        case "daily":
            return `Every ${details.every > 1 ? details.every : ""} day${details.every > 1 ? "s" : ""}`;
        case "weekly":
            // special case for weekdays, weekends
            let lastPart = caseMap.has(JSON.stringify(details.daysOfWeek))
                ? caseMap.get(JSON.stringify(details.daysOfWeek))
                : arrayToDays(details.daysOfWeek || []);
            return `Every${details.every > 1 ? details.every : ""} week${details.every > 1 ? "s" : ""} on ${lastPart}`;
        case "monthly":
            return `${frequency} ${type} - ${details?.behavior} behavior`;
        default:
            return `${frequency} - ${details?.behavior} behavior`;
    }
}
