import { Dimensions, Keyboard, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect } from "react";
import ThemedInput from "../../inputs/ThemedInput";
import Dropdown from "../../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useBlueprints } from "@/contexts/blueprintContext";
import { Screen } from "../CreateModal";
import { ThemedText } from "@/components/ThemedText";
import TrafficLight from "@/components/inputs/TrafficLight";
import ThemedSlider from "@/components/inputs/ThemedSlider";
import ConditionalView from "@/components/ui/ConditionalView";
import AdvancedOption from "./AdvancedOption";
import { useThemeColor } from "@/hooks/useThemeColor";
import Feather from "@expo/vector-icons/Feather";
import Popover from "react-native-popover-view";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { components } from "@/api/generated/types";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { updateTaskAPI } from "@/api/task";
import { ObjectId } from "bson";
import type { RecurDetails } from "@/api/types";

type CreateTaskParams = components["schemas"]["CreateTaskParams"];

type Props = {
    hide: () => void;
    goTo: (screen: Screen) => void;
    edit?: boolean;
    screen?: Screen;
    categoryId?: string; // Category ID for editing tasks
    isBlueprint?: boolean; // Flag to indicate if this modal is being used for blueprint task creation
};

const Standard = ({ hide, goTo, edit = false, categoryId, screen, isBlueprint = false }: Props) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory, updateTask, selectedCategory, setCreateCategory, task } = useTasks();
    const { addTaskToBlueprintCategory, blueprintCategories } = useBlueprints();
    const {
        taskName,
        setTaskName,
        showAdvanced,
        setShowAdvanced,
        suggestion,
        priority,
        value,
        recurring,
        recurFrequency,
        recurDetails,
        deadline,
        startTime,
        startDate,
        reminders,
        isPublic,
        resetTaskCreation,
        setPriority,
        setValue,
        setRecurring,
        setRecurFrequency,
        setRecurDetails,
        setDeadline,
        setStartTime,
        setStartDate,
        setReminders,
        setIsPublic,
        setIsBlueprint,
    } = useTaskCreation();
    const ThemedColor = useThemeColor();

    // Set the blueprint flag when component mounts or when the prop changes
    useEffect(() => {
        setIsBlueprint(isBlueprint);
    }, [isBlueprint, setIsBlueprint]); // Run when isBlueprint prop changes

    useEffect(() => {
        if (screen && edit) {
            goTo(screen);
        }
    }, [screen]);

    // Set the selected category when in edit mode
    useEffect(() => {
        if (edit && categoryId && categories && categories.length > 0) {
            const timer = setTimeout(() => {
                const taskCategory = categories.find(cat => cat.id === categoryId);
                
                if (taskCategory) {
                    setCreateCategory({ 
                        label: taskCategory.name, 
                        id: taskCategory.id, 
                        special: false 
                    });
                } else {
                    // As a last resort, set the first available category
                    if (categories.length > 0) {
                        const firstCategory = categories[0];
                        setCreateCategory({ 
                            label: firstCategory.name, 
                            id: firstCategory.id, 
                            special: false 
                        });
                    }
                }
            }, 100);
            
            return () => clearTimeout(timer);
        } else {
        }
    }, [edit, categoryId, categories]);

    const createPost = async () => {
        console.log('createPost called with context values:', {
            startDate: startDate,
            startTime: startTime,
            deadline: deadline,
            taskName: taskName
        });
        
        if (availableCategories.length === 0) return;
        
        // Trim trailing newlines and whitespace from task name
        const trimmedTaskName = taskName.replace(/[\n\r]+$/g, '').trim();
        
        if (isBlueprint) {
            // For blueprint mode, create task locally with proper TaskDocument structure
            const newTask: components["schemas"]["TaskDocument"] = {
                id: new ObjectId().toString(), // Temporary ID for local use
                content: trimmedTaskName,
                priority: priority,
                value: value,
                recurring: recurring,
                public: isPublic,
                active: false,
                checklist: [],
                notes: "",
                startDate: startDate?.toISOString(),
                startTime: startTime?.toISOString(),
                deadline: deadline?.toISOString(),
                reminders: reminders.map(reminder => ({
                    ...reminder,
                    triggerTime: reminder.triggerTime.toISOString()
                })),
                recurFrequency: recurring ? recurFrequency : undefined,
                recurDetails: recurring ? recurDetails as any : undefined,
                timestamp: new Date().toISOString(),
                lastEdited: new Date().toISOString(),
                userID: "", // Will be set by backend when blueprint is created
                categoryID: selectedCategory.id,
            };
            
            addTaskToBlueprintCategory(selectedCategory.id, newTask);
            resetTaskCreation();
            return;
        }
        
        // Normal mode - create task via API
        let postBody: CreateTaskParams = {
            content: trimmedTaskName,
            priority: priority,
            value: value,
            recurring: recurring,
            public: isPublic,
            active: false,
            checklist: [],
            notes: "", // TODO: Add notes
            startDate: startDate?.toISOString(),
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminders.map(reminder => ({
                ...reminder,
                triggerTime: reminder.triggerTime.toISOString()
            })),
        };
        if (recurring) {
            postBody.recurFrequency = recurFrequency;
            postBody.recurDetails = recurDetails as RecurDetails;
        }
        
        console.log('POST body:', JSON.stringify(postBody, null, 2));
        const response = await request("POST", `/user/tasks/${selectedCategory.id}`, postBody);

        addToCategory(selectedCategory.id, response);
        resetTaskCreation();
    };

    const updatePost = async () => {
        if (!task) return;
        
        // Trim trailing newlines and whitespace from task name
        const trimmedTaskName = taskName.replace(/[\n\r]+$/g, '').trim();
        
        const updateData: components["schemas"]["UpdateTaskDocument"] = {
            content: trimmedTaskName,
            priority: priority,
            value: value,
            recurring: recurring,
            public: isPublic,
            active: task.active || false,
            recurDetails: recurring ? recurDetails as RecurDetails : {
                every: 1,
                daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
                behavior: "ROLLING",
            },
            startDate: startDate?.toISOString(),
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminders.map(reminder => ({
                ...reminder,
                triggerTime: reminder.triggerTime.toISOString()
            })),
            notes: task.notes || "",
            checklist: task.checklist || [],
        };

        // Use the selected category from the dropdown, or fall back to the original task category
        const targetCategoryId = selectedCategory?.id || task.categoryID;
        
        // Optimistic update - update the task locally before the API call
        const defaultRecurDetails: RecurDetails = {
            every: 1,
            daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
            behavior: "ROLLING",
        };
        
        updateTask(targetCategoryId, task.id, {
            content: trimmedTaskName,
            priority: priority,
            value: value,
            recurring: recurring,
            public: isPublic,
            active: task.active || false,
            recurDetails: (recurring ? recurDetails : defaultRecurDetails) as RecurDetails,
            startDate: startDate?.toISOString() || "",
            startTime: startTime?.toISOString() || "",
            deadline: deadline?.toISOString() || "",
            reminders: reminders.map(reminder => ({
                ...reminder,
                triggerTime: reminder.triggerTime.toISOString()
            })),
            notes: task.notes || "",
            checklist: task.checklist || [],
        });
        
        try {
            // Make the API call
            await updateTaskAPI(targetCategoryId, task.id, updateData);
        } catch (error) {
            console.error("Failed to update task:", error);
            // In a production app, you might want to revert the optimistic update here
            // or show an error message to the user
        }
        
        resetTaskCreation();
    };

    // Determine which categories to use based on blueprint mode
    const availableCategories = isBlueprint ? blueprintCategories : categories;

    if (availableCategories) {
        if (availableCategories.filter((c) => c.name !== "!-proxy-!").length == 0) {
            goTo(Screen.NEW_CATEGORY);
        }
    } else {
        console.warn("Categories is null " + availableCategories);
    }

    return (
        <View style={{ gap: 8, flexDirection: "column", display: "flex" }} >
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}></View>
            </View>
            {suggestion && (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Suggested: {suggestion}
                    </ThemedText>
                </View>
            )}
            <View
                style={{
                    flexDirection: "row",
                    flex: 1,
                    justifyContent: "space-between",
                    width: "100%",
                    height: "auto",
                    minHeight: 55,
                    gap: 8,
                    zIndex: 1000,
                }}>
                <Dropdown
                    options={[
                        ...availableCategories
                            .filter((c) => c.name !== "!-proxy-!")
                            .map((c) => {
                                return { label: c.name, id: c.id, special: false };
                            }),
                        { label: "+ New Category", id: "", special: true },
                    ]}
                    ghost
                    selected={selectedCategory}
                    setSelected={setCreateCategory}
                    onSpecial={() => {
                        goTo(Screen.NEW_CATEGORY);
                    }}
                    width="76%"
                />
                <TouchableOpacity
                    style={{
                        borderRadius: 12,
                        padding: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 0,
                        borderColor: ThemedColor.text,
                    }}
                    onPress={() => {
                        if (edit) {
                            updatePost();
                        } else {
                            createPost();
                        }
                        hide();
                    }}>
                    <ThemedText type="lightBody">{edit ? "Update" : "Create"}</ThemedText>
                </TouchableOpacity>
            </View>
            <View onStartShouldSetResponder={() => true}>
                <ThemedInput
                    ghost
                    autofocus={taskName.length === 0}
                    ref={nameRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>}
                    placeHolder="Enter the Task Name"
                    textArea
                    onSubmit={() => {
                        createPost();
                        hide();
                    }}
                    onBlur={() => {
                        nameRef.current?.blur();
                        Keyboard.dismiss();
                    }}
                    onChangeText={(text) => {
                        setTaskName(text);
                    }}
                    value={taskName}
                    setValue={setTaskName}
                    textStyle={{
                        fontSize: 24,
                        fontFamily: "Outfit",
                        fontWeight: 500,
                        letterSpacing: -0.2,
                    }}
                />
            </View>
            <PrimaryOptionRow goTo={goTo} />
            <AdvancedOptionList goTo={goTo} showUnconfigured={false} />
            <TouchableOpacity
                onPress={() => {
                    setShowAdvanced(!showAdvanced);
                }}
                style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    paddingTop: 16,
                }}>
                <ThemedText type="lightBody">Advanced Options</ThemedText>
                <Feather name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={ThemedColor.text} />
            </TouchableOpacity>
            <ConditionalView condition={showAdvanced}>
                <AdvancedOptionList goTo={goTo} showUnconfigured={true} />
            </ConditionalView>
        </View>
    );
};

export default Standard;

const styles = StyleSheet.create({});

const PrimaryOptionRow = ({ goTo }: { goTo: (screen: Screen) => void }) => {
    const ThemedColor = useThemeColor();
    const [showPriority, setShowPriority] = useState(false);
    const { priority, setPriority, value, setValue, isPublic, setIsPublic, deadline } = useTaskCreation();
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
                gap: 8,
                alignItems: "center",
                marginTop: Dimensions.get("screen").height * 0.05,
            }}>
            <PriorityPicker
                showPriority={showPriority}
                setShowPriority={setShowPriority}
                priority={priority}
                setPriority={setPriority}
            />
            <DeadlineQuickAccess goTo={goTo} />
            <TouchableOpacity
                onPress={() => {
                    setIsPublic(!isPublic);
                }}
                style={{
                    backgroundColor: ThemedColor.background,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                    padding: 12,
                    flexDirection: "row",
                    gap: 4,
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                <Feather name={isPublic ? "eye" : "eye-off"} size={20} color={ThemedColor.text} />
                <ThemedText type="lightBody">{isPublic ? "Public" : "Private"}</ThemedText>
            </TouchableOpacity>
            <DifficultyPopover value={value} setValue={setValue} />
        </ScrollView>
    );
};

const PriorityPicker = ({
    showPriority,
    setShowPriority,
    priority,
    setPriority,
}: {
    showPriority: boolean;
    setShowPriority: (value: boolean) => void;
    priority: number;
    setPriority: (value: number) => void;
}) => {
    const ICON_SIZE = 20;
    const ThemedColor = useThemeColor();

    const priorityMapping = {
        0: ThemedColor.tertiary,
        1: ThemedColor.success,
        2: ThemedColor.warning,
        3: ThemedColor.error,
        4: ThemedColor.error,
    };

    return (
        <Popover
            popoverStyle={{
                backgroundColor: ThemedColor.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
                width: Dimensions.get("window").width * 0.4,
                padding: 12,
            }}
            isVisible={showPriority}
            onRequestClose={() => {
                setShowPriority(false);
            }}
            from={
                <TouchableOpacity
                    onPress={() => {
                        setShowPriority(true);
                    }}
                    style={{
                        backgroundColor: ThemedColor.background,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        flexDirection: "row",
                        gap: 4,
                        padding: 12,
                    }}>
                    <Feather name="flag" size={ICON_SIZE} color={priorityMapping[priority]} />
                    <ThemedText type="lightBody" style={{ fontSize: 16 }}>
                        Priority
                    </ThemedText>
                </TouchableOpacity>
            }>
            <ThemedText
                type="defaultSemiBold"
                style={{
                    padding: 12,
                    textAlign: "left",
                    fontWeight: 500,
                    fontSize: 20,
                }}>
                Priority
            </ThemedText>
            <View style={{ padding: 12 }}>
                <TrafficLight
                    setValue={(value) => {
                        setPriority(value);
                        setShowPriority(false);
                    }}
                    value={priority}
                />
            </View>
        </Popover>
    );
};

const DifficultyPopover = ({ value, setValue }: { value: number; setValue: (value: number) => void }) => {
    const [showDifficulty, setShowDifficulty] = React.useState(false);
    const ICON_SIZE = 20;
    const ThemedColor = useThemeColor();
    return (
        <Popover
            popoverStyle={{
                backgroundColor: ThemedColor.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
                width: Dimensions.get("window").width * 0.8,
                padding: 16,
                alignItems: "center",
            }}
            isVisible={showDifficulty}
            onRequestClose={() => setShowDifficulty(false)}
            from={
                <TouchableOpacity
                    onPress={() => setShowDifficulty(true)}
                    style={{
                        backgroundColor: ThemedColor.background,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        flexDirection: "row",
                        gap: 4,
                        padding: 12,
                    }}>
                    <FontAwesome6 name="dumbbell" size={ICON_SIZE} color={ThemedColor.primary} />
                    <ThemedText type="lightBody" style={{ fontSize: 16 }}>
                        Difficulty
                    </ThemedText>
                </TouchableOpacity>
            }>
            <ThemedText
                type="defaultSemiBold"
                style={{
                    padding: 12,
                    textAlign: "left",
                    fontWeight: 500,
                    fontSize: 20,
                }}>
                Difficulty: Level {value}
            </ThemedText>
            <ThemedSlider setStep={setValue} width={0.7} />
        </Popover>
    );
};

const DeadlineQuickAccess = ({ goTo }: { goTo: (screen: Screen) => void }) => {
    const ThemedColor = useThemeColor();
    const { deadline } = useTaskCreation();
    const ICON_SIZE = 20;
    
    // Hide the button when deadline is set
    if (deadline) {
        return null;
    }
    
    return (
        <TouchableOpacity
            onPress={() => goTo(Screen.DEADLINE)}
            style={{
                backgroundColor: ThemedColor.background,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
                flexDirection: "row",
                gap: 4,
                padding: 12,
            }}>
            <Feather 
                name="alert-circle" 
                size={ICON_SIZE} 
                color={ThemedColor.text} 
            />
            <ThemedText type="lightBody">
                Deadline
            </ThemedText>
        </TouchableOpacity>
    );
};

const AdvancedOptionList = ({
    goTo,
    showUnconfigured,
}: {
    goTo: (screen: Screen) => void;
    showUnconfigured: boolean;
}) => {
    const { startDate, startTime, deadline, reminders, recurring, recurFrequency, isBlueprint: isBlueprintMode } = useTaskCreation();
    
    // Check if start date is the blueprint default date (Jan 1, 1970 at midnight)
    // Only consider it as "not configured" if we're in blueprint mode AND it matches the exact default
    const isBlueprintDefaultDate = isBlueprintMode && startDate && 
        startDate.getFullYear() === 1970 && 
        startDate.getMonth() === 0 && 
        startDate.getDate() === 1 &&
        startDate.getHours() === 0 &&
        startDate.getMinutes() === 0 &&
        startDate.getSeconds() === 0;
    
    // Start date is configured if it exists AND (we're not in blueprint mode OR it's not the default date)
    const startDateConfigured = startDate !== null && !isBlueprintDefaultDate;
    
    return (
        <View style={{ gap: 12, marginTop: 4 }}>
            <AdvancedOption
                icon="calendar"
                label={
                    startDate && startTime 
                        ? `Start: ${startDate.toLocaleDateString()} ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : startDate 
                        ? `Start Date: ${startDate.toLocaleDateString()}`
                        : "Set Start Date & Time"
                }
                screen={Screen.STARTDATE}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={startDateConfigured}
            />
            <AdvancedOption
                icon="flag"
                label={deadline ? "Deadline: " + deadline.toLocaleString() : "Set Deadline"}
                screen={Screen.DEADLINE}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={deadline !== null}
            />
            <AdvancedOption
                icon="repeat"
                label={recurring ? "Recurring: " + recurFrequency : "Make Recurring"}
                screen={Screen.RECURRING}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={recurring}
            />
            <AdvancedOption
                icon="alarm"
                label={
                    reminders.length > 0
                        ? reminders.length === 1
                            ? `Reminder: ${reminders[0].triggerTime.toLocaleString()}`
                            : `Reminders: ${reminders
                                  .map((r) => r.triggerTime.toLocaleTimeString())
                                  .join(", ")}`
                        : "Add Reminder"
                }
                screen={Screen.REMINDER}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={reminders.length > 0}
            />
            <AdvancedOption
                icon="people"
                label="Add Collaborators"
                screen={Screen.COLLABORATORS}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={false}
            />
        </View>
    );
};
