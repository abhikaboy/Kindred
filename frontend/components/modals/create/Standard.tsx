import { Dimensions, Keyboard, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect, useMemo } from "react";
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
import { CaretUp, CaretDown, Eye, EyeSlash, Flag, Barbell, WarningCircle, Plugs } from "phosphor-react-native";
import Popover from "react-native-popover-view";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { components } from "@/api/generated/types";
import { updateTaskAPI, updateTemplateAPI } from "@/api/task";
import { ObjectId } from "bson";
import type { RecurDetails } from "@/api/types";
import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep, hide } from "react-native-spotlight-tour";
import { useSpotlight } from "@/contexts/SpotlightContext";
import { TourStepCard } from "@/components/spotlight/TourStepCard";
import { SPOTLIGHT_MOTION } from "@/constants/spotlightConfig";
import CustomAlert, { AlertButton } from "../CustomAlert";
import { updatePost } from "@/api/post";
import * as Haptics from "expo-haptics";

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
    const ThemedColor = useThemeColor();
    const { spotlightState, setSpotlightShown } = useSpotlight();

    // Tour steps for task creation
    const tourSteps: TourStep[] = [
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Category 📂"
                    description="This dropdown lets you choose which category the task belongs to. Categories help organize your tasks!"
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("taskSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Public/Private 👁️"
                    description="Toggle whether this task is visible on your profile. Public tasks can be seen by friends, private tasks are just for you!"
                    onNext={next}
                    onSkip={() => {
                        setSpotlightShown("taskSpotlight");
                        stop();
                    }}
                />
            ),
        },
        {
            render: ({ next, stop }) => (
                <TourStepCard
                    title="Advanced Options ⚙️"
                    description="Tap here to set start times, reminders, deadlines, and more advanced task settings!"
                    onNext={() => {
                        setSpotlightShown("taskSpotlight");
                        next();
                    }}
                    isLastStep
                />
            ),
        },
    ];

    return (
        <SpotlightTourProvider steps={tourSteps} motion={SPOTLIGHT_MOTION}>
            <StandardContent
                hide={hide}
                goTo={goTo}
                edit={edit}
                categoryId={categoryId}
                screen={screen}
                isBlueprint={isBlueprint}
                spotlightState={spotlightState}
            />
        </SpotlightTourProvider>
    );
};

const StandardContent = ({
    hide,
    goTo,
    edit = false,
    categoryId,
    screen,
    isBlueprint = false,
    spotlightState,
}: Props & { spotlightState: any }) => {
    const nameRef = React.useRef<TextInput>(null);
    const { request } = useRequest();
    const { categories, addToCategory, updateTask, removeFromCategory, selectedCategory, setCreateCategory, task } = useTasks();
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
        integration,
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
        isBlueprint: isBlueprintState,
        setIsBlueprint,
    } = useTaskCreation();
    const ThemedColor = useThemeColor();
    const { start } = useSpotlightTour();

    // Determine which categories to use based on blueprint mode
    // Use state version from context (synced from prop via useEffect)
    // Memoize to ensure it updates when dependencies change
    const availableCategories = useMemo(() => {
        return isBlueprintState ? blueprintCategories : categories;
    }, [isBlueprintState, blueprintCategories, categories]);

    // Alert state
    const [alertVisible, setAlertVisible] = React.useState(false);
    const [alertTitle, setAlertTitle] = React.useState("");
    const [alertMessage, setAlertMessage] = React.useState("");
    const [alertButtons, setAlertButtons] = React.useState<AlertButton[]>([]);

    // Check if categories are available, redirect if not
    useEffect(() => {
        if (availableCategories) {
            if (availableCategories.filter((c) => c.name !== "!-proxy-!").length === 0) {
                goTo(Screen.NEW_CATEGORY);
            }
        } else {
            console.warn("Categories is null", availableCategories);
        }
    }, [availableCategories, goTo]);

    // Set the blueprint flag when component mounts or when the prop changes
    useEffect(() => {
        setIsBlueprint(isBlueprint);
    }, [isBlueprint, setIsBlueprint]); // Run when isBlueprint prop changes

    // Start the spotlight tour if this is the first time creating a task
    useEffect(() => {
        if (!spotlightState.taskSpotlight && spotlightState.workspaceSpotlight && !edit) {
            const timer = setTimeout(() => {
                start();
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [start, spotlightState.taskSpotlight, spotlightState.workspaceSpotlight, edit]);

    useEffect(() => {
        if (screen && edit) {
            goTo(screen);
        }
    }, [screen]);

    // Set the selected category when categoryId is provided (for both edit and create modes)
    useEffect(() => {
        if (categoryId && categories && categories.length > 0) {
            const timer = setTimeout(() => {
                const taskCategory = categories.find((cat) => cat.id === categoryId);

                if (taskCategory) {
                    setCreateCategory({
                        label: taskCategory.name,
                        id: taskCategory.id,
                        special: false,
                    });
                } else {
                    // As a last resort, set the first available category
                    if (categories.length > 0) {
                        const firstCategory = categories[0];
                        setCreateCategory({
                            label: firstCategory.name,
                            id: firstCategory.id,
                            special: false,
                        });
                    }
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [categoryId, categories]);

    const createPost = async () => {
        if (!availableCategories || availableCategories.length === 0) return;

        // Trim trailing newlines and whitespace from task name
        const trimmedTaskName = taskName.replace(/[\n\r]+$/g, "").trim();

        if (isBlueprintState) {
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
                reminders: reminders.map((reminder) => ({
                    ...reminder,
                    triggerTime: reminder.triggerTime.toISOString(),
                })),
                recurFrequency: recurring ? recurFrequency : undefined,
                recurDetails: recurring ? (recurDetails as any) : undefined,
                timestamp: new Date().toISOString(),
                lastEdited: new Date().toISOString(),
                userID: "", // Will be set by backend when blueprint is created
                categoryID: selectedCategory.id,
                posted: false,
            };

            addTaskToBlueprintCategory(selectedCategory.id, newTask);
            resetTaskCreation();
            return;
        }

        // Normal mode - create task via API with optimistic update
        const tempId = new ObjectId().toString();

        // Create optimistic task
        const optimisticTask: any = {
            id: tempId,
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
            reminders: reminders.map((reminder) => ({
                ...reminder,
                triggerTime: reminder.triggerTime.toISOString(),
            })),
            recurFrequency: recurring ? recurFrequency : undefined,
            recurDetails: recurring ? (recurDetails as any) : undefined,
            timestamp: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            userID: "", // Will be populated by backend
            categoryID: selectedCategory.id,
            posted: false,
        };

        // Add optimistically to UI
        addToCategory(selectedCategory.id, optimisticTask);
        resetTaskCreation();

        // Make API call in background
        let postBody: any = {
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
            reminders: reminders.map((reminder) => ({
                ...reminder,
                triggerTime: reminder.triggerTime.toISOString(),
            })),
            integration: integration || undefined,
        };
        if (recurring) {
            postBody.recurFrequency = recurFrequency;
            postBody.recurDetails = recurDetails as RecurDetails;
        }

        try {
            const response = await request("POST", `/user/tasks/${selectedCategory.id}`, postBody as CreateTaskParams);

            // Remove optimistic task and add real one
            // This ensures we don't have ID mismatches
            removeFromCategory(selectedCategory.id, tempId);
            addToCategory(selectedCategory.id, response);
        } catch (error) {
            console.error("Failed to create task:", error);

            // Remove optimistic task on error
            removeFromCategory(selectedCategory.id, tempId);

            // Show error toast
            const { showToastable } = await import("react-native-toastable");

            showToastable({
                message: "Failed to create task. Please try again.",
                status: "danger",
                duration: 3000,
            });
        }
    };

    const updatePost = async () => {
        if (!task) return;

        // Trim trailing newlines and whitespace from task name
        const trimmedTaskName = taskName.replace(/[\n\r]+$/g, "").trim();

    let updateData: any = {
        content: trimmedTaskName,
        priority: priority,
        value: value,
        recurring: recurring,
        public: isPublic,
        active: task.active || false,
        recurDetails: recurring
            ? (recurDetails as RecurDetails)
            : {
                  every: 1,
                  daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
                  behavior: "ROLLING",
              },
        startDate: startDate?.toISOString(),
        startTime: startTime?.toISOString(),
        deadline: deadline?.toISOString(),
        reminders: reminders.map((reminder) => ({
            ...reminder,
            triggerTime: reminder.triggerTime.toISOString(),
        })),
        notes: task.notes || "",
        checklist: task.checklist || [],
        integration: integration || undefined,
    };

    // Use the selected category from the dropdown, or fall back to the original task category
    const targetCategoryId = selectedCategory?.id || task.categoryID;

    // Optimistic update - update the task locally before the API call
    const defaultRecurDetails: RecurDetails = {
        every: 1,
        daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
        behavior: "ROLLING",
    };

    // Check if we should request template generation
    // Only generate template if recurring is true AND it wasn't recurring before (or didn't have a template)
    const generateTemplate = recurring && (!task.recurring || !task.templateID);

    // Merge what would have been in the second block here if needed
    if (recurring) {
        updateData.recurFrequency = recurFrequency;
    }
    updateData.generateTemplate = generateTemplate;

    updateTask(targetCategoryId, task.id, updateData);

    try {
        // Make the API call
        await updateTaskAPI(targetCategoryId, task.id, updateData);
    } catch (error) {
        console.error("Failed to update task:", error);
    }
};
    const handleUpdateOrTemplate = async () => {
        if (task.templateID) {
            setAlertTitle("Update Recurring Task");
            setAlertMessage("Do you want to update only this occurrence or all future tasks?");
            setAlertButtons([
                {
                    text: "Only This Task",
                    onPress: async () => {
                        setAlertVisible(false);
                        await updatePost();
                        resetTaskCreation();
                        hide();
                    }
                },
                {
                    text: "All Future Tasks",
                    onPress: async () => {
                        setAlertVisible(false);
                        await performTemplateUpdate();
                        resetTaskCreation();
                        hide();
                    }
                },
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => {}
                }
            ]);
            setAlertVisible(true);
        } else {
            await updatePost();
            resetTaskCreation();
            hide();
        }
    };

    const performTemplateUpdate = async () => {
            if (!task.templateID) return;

            // 1. Update the current task first
            await updatePost();

            // 2. Update the template
            try {
            const templateUpdateData: components["schemas"]["UpdateTemplateDocument"] = {
                content: taskName,
                priority: priority,
                value: value,
                public: isPublic,
                recurDetails: recurring ? (recurDetails as RecurDetails) : undefined,
                recurFrequency: recurring ? recurFrequency : undefined,
                startDate: startDate?.toISOString(),
                startTime: startTime?.toISOString(),
                deadline: deadline?.toISOString(),
                reminders: reminders.map((reminder) => ({
                    ...reminder,
                    triggerTime: reminder.triggerTime.toISOString(),
                })),
                notes: task.notes || "",
                checklist: task.checklist || [],
            };
            await updateTemplateAPI(task.templateID, templateUpdateData);
            } catch (error) {
            console.error("Failed to update template:", error);
            }
    };




    return (
        <View style={{ gap: 8, flexDirection: "column", display: "flex" }}>

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
                }}
                pointerEvents="box-none">
                <AttachStep index={0} style={{ width: "76%" }}>
                    <Dropdown
                        options={[
                            ...(availableCategories || [])
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
                        width="100%"
                    />
                </AttachStep>
                <TouchableOpacity
                    style={{
                        borderRadius: 12,
                        padding: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 0,
                        borderColor: ThemedColor.text,
                        zIndex: 1001,
                    }}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    activeOpacity={0.7}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        if (edit) {
                            handleUpdateOrTemplate();
                        } else {
                            createPost();
                            hide();
                        }
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
            <AttachStep index={2}>
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
                    {showAdvanced ? (
                        <CaretUp size={20} color={ThemedColor.text} weight="bold" />
                    ) : (
                        <CaretDown size={20} color={ThemedColor.text} weight="bold" />
                    )}
                </TouchableOpacity>
            </AttachStep>
            <ConditionalView condition={showAdvanced}>
                <AdvancedOptionList goTo={goTo} showUnconfigured={true} />
            </ConditionalView>

            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
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
            <AttachStep index={1}>
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
                    {isPublic ? (
                        <Eye size={20} color={ThemedColor.text} weight="regular" />
                    ) : (
                        <EyeSlash size={20} color={ThemedColor.text} weight="regular" />
                    )}
                    <ThemedText type="lightBody">{isPublic ? "Public" : "Private"}</ThemedText>
                </TouchableOpacity>
            </AttachStep>
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
                    <Flag size={ICON_SIZE} color={priorityMapping[priority]} weight="fill" />
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
                    <Barbell size={ICON_SIZE} color={ThemedColor.primary} weight="fill" />
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
            <WarningCircle size={ICON_SIZE} color={ThemedColor.text} weight="regular" />
            <ThemedText type="lightBody">Deadline</ThemedText>
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
    const {
        startDate,
        startTime,
        deadline,
        reminders,
        recurring,
        recurFrequency,
        isBlueprint: isBlueprintMode,
        integration,
    } = useTaskCreation();
    const ThemedColor = useThemeColor();

    // Check if start date is the blueprint default date (Jan 1, 1970 at midnight)
    // Only consider it as "not configured" if we're in blueprint mode AND it matches the exact default
    const isBlueprintDefaultDate =
        isBlueprintMode &&
        startDate &&
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
                        ? `Start: ${startDate.toLocaleDateString()} ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
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
                            : `Reminders: ${reminders.map((r) => r.triggerTime.toLocaleTimeString()).join(", ")}`
                        : "Add Reminder"
                }
                screen={Screen.REMINDER}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={reminders.length > 0}
            />
            <AdvancedOption
                iconComponent={<Plugs size={24} color={ThemedColor.text} weight="regular" />}
                label={integration ? `Integration: ${integration.charAt(0).toUpperCase() + integration.slice(1)}` : "Add Integration"}
                screen={Screen.INTEGRATION}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={integration !== ""}
            />
            {/* <AdvancedOption
                icon="people"
                label="Add Collaborators"
                screen={Screen.COLLABORATORS}
                goTo={goTo}
                showUnconfigured={showUnconfigured}
                configured={false}
            /> */}
        </View>
    );
};
