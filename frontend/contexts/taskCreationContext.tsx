import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { useReminder, Reminder } from "@/hooks/useReminder";
import { FlexDetails, ChecklistItem } from "@/api/types";
import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";

type TaskCreationContextType = {
    taskName: string;
    setTaskName: (name: string) => void;
    resetTaskCreation: () => void;
    loadTaskData: (taskData: any) => void; // Function to load task data for editing
    showAdvanced: boolean;
    setShowAdvanced: (show: boolean) => void;
    priority: number;
    value: number;
    recurring: boolean;
    recurFrequency: string;
    recurDetails: {
        every: number;
        daysOfWeek: number[];
        daysOfMonth?: number[];
        months?: number[];
        behavior: string;
    };
    deadline: Date | null;
    startTime: Date | null;
    startDate: Date | null;
    reminders: Reminder[];
    /** Every reminder on the task was added automatically when a date was picked. */
    remindersAuto: boolean;
    setReminders: (reminders: Reminder[]) => void;
    isPublic: boolean;
    setIsPublic: (isPublic: boolean) => void;
    isBlueprint: boolean;
    setIsBlueprint: (isBlueprint: boolean) => void;
    flexDetails: FlexDetails | null;
    setFlexDetails: (flexDetails: FlexDetails | null) => void;
    integration: string;
    setIntegration: (integration: string) => void;
    setPriority: (priority: number) => void;
    setValue: (value: number) => void;
    setRecurring: (recurring: boolean) => void;
    setRecurFrequency: (recurFrequency: string) => void;
    setRecurDetails: (recurDetails: {
        every: number;
        daysOfWeek: number[];
        daysOfMonth?: number[];
        months?: number[];
        behavior: string;
    }) => void;
    setDeadline: (deadline: Date | null) => void;
    addSmartDeadlineReminders: (deadline: Date) => void;
    setStartTime: (startTime: Date | null) => void;
    setStartDate: (startDate: Date | null) => void;
    addSmartStartReminders: (startDate: Date, startTime: Date | null) => void;
    taggedUsers: TaggedUser[];
    setTaggedUsers: (users: TaggedUser[]) => void;
    /** Notes/checklist prefill — used by the tag Copy flow; create otherwise sends empty. */
    notes: string;
    setNotes: (notes: string) => void;
    checklist: ChecklistItem[];
    setChecklist: (items: ChecklistItem[]) => void;
    /** When set, a successful create marks this original task's tag as "copied". */
    copySourceTaskId: string | null;
    setCopySourceTaskId: (id: string | null) => void;
};

type TaskCreationActions = Pick<
    TaskCreationContextType,
    | "setTaskName"
    | "resetTaskCreation"
    | "loadTaskData"
    | "setShowAdvanced"
    | "setReminders"
    | "setIsPublic"
    | "setIsBlueprint"
    | "setFlexDetails"
    | "setIntegration"
    | "setPriority"
    | "setValue"
    | "setRecurring"
    | "setRecurFrequency"
    | "setRecurDetails"
    | "setDeadline"
    | "addSmartDeadlineReminders"
    | "setStartTime"
    | "setStartDate"
    | "addSmartStartReminders"
    | "setTaggedUsers"
    | "setNotes"
    | "setChecklist"
    | "setCopySourceTaskId"
>;

const TaskCreationContext = createContext<TaskCreationContextType | undefined>(undefined);
// Stable for the provider's lifetime, so components that only open/prefill the create
// modal (task cards, daily, task detail) don't re-render on every keystroke in it.
const TaskCreationActionsContext = createContext<TaskCreationActions | undefined>(undefined);

// Helper function to create a unique key for a reminder
const getReminderKey = (reminder: Reminder): string => {
    return `${reminder.triggerTime.getTime()}-${reminder.type}-${reminder.beforeDeadline}-${reminder.beforeStart}`;
};

// Helper function to add reminders without duplicates
const addRemindersUnique = (existingReminders: Reminder[], newReminders: Reminder[]): Reminder[] => {
    // Create a Map using unique keys
    const reminderMap = new Map<string, Reminder>();

    // Add existing reminders
    existingReminders.forEach(reminder => {
        const key = getReminderKey(reminder);
        reminderMap.set(key, reminder);
    });

    // Add new reminders (will overwrite if key exists, ensuring no duplicates)
    newReminders.forEach(reminder => {
        const key = getReminderKey(reminder);
        reminderMap.set(key, reminder);
    });

    // Convert back to array
    return Array.from(reminderMap.values());
};

// Function to get default start date based on blueprint mode
const getDefaultStartDate = (isBlueprintMode: boolean | undefined): Date | null => {
    if (isBlueprintMode === true) {
        // Return January 1, 1970 for blueprint mode
        const defaultDate = new Date(1970, 0, 1); // Month is 0-indexed, so 0 = January
        return defaultDate;
    }
    // Return null for normal mode (no default date) or undefined
    return null;
};

export const TaskCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [taskName, setTaskName] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [priority, setPriority] = useState(1);
    const [value, setValue] = useState(1);
    const [recurring, setRecurring] = useState(false);
    const [recurFrequency, setRecurFrequency] = useState("");
    const [recurDetails, setRecurDetails] = useState<TaskCreationContextType["recurDetails"]>({
        every: 1,
        daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
        behavior: "ROLLING",
    });
    const [deadline, setDeadline] = useState<Date | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [reminders, setRemindersRaw] = useState<Reminder[]>([]);
    const [remindersAuto, setRemindersAuto] = useState(false);
    // Anyone outside this file setting reminders is the user choosing them.
    const setReminders = useCallback((next: Reminder[]) => {
        setRemindersAuto(false);
        setRemindersRaw(next);
    }, []);
    const [isPublic, setIsPublic] = useState(true);
    const [isBlueprint, setIsBlueprint] = useState(false);
    const [integration, setIntegration] = useState("");
    const [flexDetails, setFlexDetails] = useState<FlexDetails | null>(null);
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    const [notes, setNotes] = useState("");
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [copySourceTaskId, setCopySourceTaskId] = useState<string | null>(null);

    const { getDeadlineReminder, getStartDateReminder, getStartTimeReminder } = useReminder();
    const isBlueprintRef = useRef(isBlueprint);
    isBlueprintRef.current = isBlueprint;

    // Custom setIsBlueprint function that also sets the start date
    const setIsBlueprintWithStartDate = useCallback((isBlueprintMode: boolean) => {
        // Only update start date if blueprint mode is actually changing
        if (isBlueprintRef.current !== isBlueprintMode) {
            setIsBlueprint(isBlueprintMode);
            // Set the start date based on blueprint mode
            const defaultStartDate = getDefaultStartDate(isBlueprintMode);
            setStartDate(defaultStartDate);
        }
    }, []);

    // Add smart deadline reminders — call only at final submission, not during intermediate changes
    const addSmartDeadlineReminders = useCallback((dl: Date) => {
        const reminder = getDeadlineReminder(dl);
        if (reminder) {
            setRemindersRaw((prev) => {
                // Only auto if nothing the user picked was already there
                if (prev.length === 0) setRemindersAuto(true);
                return addRemindersUnique(prev, [reminder]);
            });
        }
    }, [getDeadlineReminder]);

    // Add smart start reminders — call only at final submission, not during intermediate changes
    const addSmartStartReminders = useCallback((sd: Date, st: Date | null) => {
        const atStartReminder = getStartDateReminder(sd, st);
        const beforeStartReminder = getStartTimeReminder(sd, st);

        setRemindersRaw((prev) => {
            if (prev.length === 0) setRemindersAuto(true);
            // Remove old start-time related reminders
            const filtered = prev.filter(
                (r) =>
                    !(r.type === "ABSOLUTE" && !r.beforeDeadline && !r.beforeStart) &&
                    !r.beforeStart
            );

            const newReminders = [];
            if (atStartReminder) newReminders.push(atStartReminder);
            if (beforeStartReminder) newReminders.push(beforeStartReminder);

            return addRemindersUnique(filtered, newReminders);
        });
    }, [getStartDateReminder, getStartTimeReminder]);

    const resetTaskCreation = useCallback(() => {
        setTaskName("");
        setPriority(1);
        setValue(1);
        setRecurring(false);
        setRecurFrequency("");
        setRecurDetails({
            every: 1,
            daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
            behavior: "ROLLING",
        });
        setDeadline(null);
        setStartTime(null);
        // Set start date based on current blueprint mode
        const defaultStartDate = getDefaultStartDate(isBlueprintRef.current);
        setStartDate(defaultStartDate);
        setReminders([]);
        setIsPublic(true);
        setIntegration("");
        setFlexDetails(null);
        setTaggedUsers([]);
        setNotes("");
        setChecklist([]);
        setCopySourceTaskId(null);
        // Don't reset isBlueprint here as it should persist
        setShowAdvanced(false);
    }, []);

    const loadTaskData = useCallback((taskData: any) => {
        setTaskName(taskData.content || "");
        setPriority(taskData.priority || 1);
        setValue(taskData.value || 3);
        setRecurring(taskData.recurring || false);
        setRecurFrequency(taskData.recurFrequency || "");

        // Handle recurDetails with proper defaults
        if (taskData.recurDetails) {
            setRecurDetails({
                every: taskData.recurDetails.every || 1,
                daysOfWeek: taskData.recurDetails.daysOfWeek || [0, 0, 0, 0, 0, 0, 0],
                daysOfMonth: taskData.recurDetails.daysOfMonth,
                months: taskData.recurDetails.months,
                behavior: (taskData.recurDetails?.behavior as "BUILDUP" | "ROLLING") || "ROLLING",
            });
        } else {
            setRecurDetails({
                every: 1,
                daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
                behavior: "ROLLING",
            });
        }

        // IMPORTANT: Use the raw setters, not the wrapped ones that add reminders
        // This prevents cascading state updates that can block the modal from opening
        setDeadline(taskData.deadline ? new Date(taskData.deadline) : null);
        setStartTime(taskData.startTime ? new Date(taskData.startTime) : null);
        setStartDate(taskData.startDate ? new Date(taskData.startDate) : null);

        // Set reminders directly from task data
        setRemindersAuto(false);
        setRemindersRaw(
            taskData.reminders?.map((reminder) => ({
                ...reminder,
                triggerTime: new Date(reminder.triggerTime),
            })) || []
        );

        setIsPublic(taskData.public !== undefined ? taskData.public : true);
        setIsBlueprint(taskData.isBlueprint || false);
        setIntegration(taskData.integration || "");
        setFlexDetails(taskData.recurDetails?.flex || null);
        setNotes(taskData.notes || "");
        setChecklist(taskData.checklist || []);
        setTaggedUsers([]);
    }, []);

    const actions = useMemo<TaskCreationActions>(() => ({
        setTaskName,
        resetTaskCreation,
        loadTaskData,
        setShowAdvanced,
        setReminders,
        setIsPublic,
        setIsBlueprint: setIsBlueprintWithStartDate,
        setFlexDetails,
        setIntegration,
        setPriority,
        setValue,
        setRecurring,
        setRecurFrequency,
        setRecurDetails,
        setDeadline,
        addSmartDeadlineReminders,
        setStartTime,
        setStartDate,
        addSmartStartReminders,
        setTaggedUsers,
        setNotes,
        setChecklist,
        setCopySourceTaskId,
    }), [resetTaskCreation, loadTaskData, setReminders, setIsBlueprintWithStartDate, addSmartDeadlineReminders, addSmartStartReminders]);

    const contextValue = useMemo(() => ({
        ...actions,
        taskName,
        showAdvanced,
        priority,
        value,
        recurring,
        recurFrequency,
        recurDetails,
        deadline,
        startTime,
        startDate,
        reminders,
        remindersAuto,
        isPublic,
        isBlueprint,
        flexDetails,
        integration,
        taggedUsers,
        notes,
        checklist,
        copySourceTaskId,
    }), [
        actions, taskName, showAdvanced, priority, value,
        recurring, recurFrequency, recurDetails, deadline,
        startTime, startDate, reminders, remindersAuto, isPublic, isBlueprint,
        integration, flexDetails, taggedUsers, notes, checklist, copySourceTaskId,
    ]);

    return (
        <TaskCreationActionsContext.Provider value={actions}>
            <TaskCreationContext.Provider value={contextValue}>
                {children}
            </TaskCreationContext.Provider>
        </TaskCreationActionsContext.Provider>
    );
};

export const useTaskCreation = () => {
    const context = useContext(TaskCreationContext);
    if (context === undefined) {
        throw new Error("useTaskCreation must be used within a TaskCreationProvider");
    }
    return context;
};

/** Setters/actions only — never re-renders when the draft task changes. */
export const useTaskCreationActions = () => {
    const context = useContext(TaskCreationActionsContext);
    if (context === undefined) {
        throw new Error("useTaskCreationActions must be used within a TaskCreationProvider");
    }
    return context;
};
