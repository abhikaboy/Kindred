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
import { ErrorBoundaryProps, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import DataCard from "@/components/task/DataCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useTasks } from "@/contexts/tasksContext";
import ConditionalView from "@/components/ui/ConditionalView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useDebounce } from "@/hooks/useDebounce";
import { updateNotesAPI, updateChecklistAPI } from "@/api/task";
import Checklist from "@/components/task/Checklist";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";

export const unstable_settings = {
    initialRouteName: "index",
};

export default function Task() {
    const [activeTab, setActiveTab] = useState(0);
    const { name, id, categoryId } = useLocalSearchParams();
    let ThemedColor = useThemeColor();
    const { task } = useTasks();
    const [isRunning, setIsRunning] = useState(false);
    const [time, setTime] = useState(new Date());
    const [baseTime, setBaseTime] = useState(new Date());
    const [localNotes, setLocalNotes] = useState("");

    // Add a ref to track mounted state
    const isMounted = useRef(true);

    const safeAsync = useSafeAsync();

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

    useEffect(() => {
        console.log(task);
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

    console.log(task);
    const updateNotes = useDebounce(async (notes: string) => {
        if (task && categoryId && id) {
            await updateNotesAPI(categoryId as string, id as string, notes);
        }
    }, 2000);

    return (
        <ThemedView
            style={{
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: HORIZONTAL_PADDING,
                gap: 16,
            }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <ThemedText type="title">
                    {name}
                    {isRunning ? <MaterialIcons name="timer" size={24} color={ThemedColor.text} /> : ""}
                </ThemedText>
            </View>
            <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={setActiveTab} />
            <ConditionalView condition={activeTab === 0}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
                    <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 50 }}>
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
                                    color: ThemedColor.body,
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
                                    }}>
                                    <ThemedText type="lightBody">
                                        {new Date(task?.deadline).toLocaleDateString()}
                                    </ThemedText>
                                    <ThemedText type="lightBody">
                                        {task?.deadline
                                            ? new Date(task?.deadline).toLocaleTimeString()
                                            : "No Deadline Time"}
                                    </ThemedText>
                                </View>
                            </DataCard>
                        </ConditionalView>
                        <ConditionalView
                            condition={task?.recurring != null || task?.recurDetails != null}
                            key="recurring">
                            <DataCard title="Recurring">
                                <View>
                                    <ThemedText type="lightBody">{JSON.stringify(task?.recurDetails)}</ThemedText>
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
                    </ScrollView>
                </KeyboardAvoidingView>
            </ConditionalView>
            <ConditionalView condition={activeTab === 1}>
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
                    <View style={{ flexDirection: "row", justifyContent: "center", width: "100%", marginTop: 24 }}>
                        <ThemedText type="lightBody">Tap the stopwatch to begin</ThemedText>
                    </View>
                </ConditionalView>
                <ConditionalView condition={isRunning}>
                    <View style={{ flexDirection: "row", justifyContent: "center", width: "100%", marginTop: 24 }}>
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
            </ConditionalView>
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
