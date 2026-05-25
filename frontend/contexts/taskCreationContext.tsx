import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useReminder, Reminder } from "@/hooks/useReminder";
import { FlexDetails } from "@/api/types";

type TaskCreationContextType = {
    taskName: string;
    setTaskName: (name: string) => void;
    resetTaskCreation: () => void;
    loadTaskData: (taskData: any) => void; // Function to load task data for editing
    showAdvanced: boolean;
    setShowAdvanced: (show: boolean) => void;
    suggestion: string;
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
};

const TaskCreationContext = createContext<TaskCreationContextType | undefined>(undefined);

export const TaskCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [taskName, setTaskNameState] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [suggestion, setSuggestion] = useState("");
    const [priority, setPriority] = useState(1);
    const [value, setValue] = useState(1);
    const [recurring, setRecurring] = useState(false);
    const [recurFrequency, setRecurFrequency] = useState("");
    const [recurDetails, setRecurDetails] = useState({
        every: 1,
        daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
        behavior: "ROLLING",
    });
    const [deadline, setDeadline] = useState<Date | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [isPublic, setIsPublic] = useState(true);
    const [isBlueprint, setIsBlueprint] = useState(false);
    const [integration, setIntegration] = useState("");
    const [flexDetails, setFlexDetails] = useState<FlexDetails | null>(null);

    const { getDeadlineReminder, getStartDateReminder, getStartTimeReminder } = useReminder();

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

    // Internal function to set blueprint state without triggering start date logic
    const setBlueprintStateInternal = (isBlueprintMode: boolean) => {
        setIsBlueprint(isBlueprintMode);
    };

    // Custom setIsBlueprint function that also sets the start date
    const setIsBlueprintWithStartDate = (isBlueprintMode: boolean) => {
        // Only update start date if blueprint mode is actually changing
        if (isBlueprint !== isBlueprintMode) {
            setBlueprintStateInternal(isBlueprintMode);
            // Set the start date based on blueprint mode
            const defaultStartDate = getDefaultStartDate(isBlueprintMode);
            setStartDate(defaultStartDate);
        }
    };

    // Add smart deadline reminders — call only at final submission, not during intermediate changes
    const addSmartDeadlineReminders = (dl: Date) => {
        const reminder = getDeadlineReminder(dl);
        if (reminder) {
            setReminders((prev) => addRemindersUnique(prev, [reminder]));
        }
    };

    // Add smart start reminders — call only at final submission, not during intermediate changes
    const addSmartStartReminders = (sd: Date, st: Date | null) => {
        const atStartReminder = getStartDateReminder(sd, st);
        const beforeStartReminder = getStartTimeReminder(sd, st);

        setReminders((prev) => {
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
    };

    const setTaskName = (name: string) => {
        setTaskNameState(name);
        // check if the name has the word "at {number}" or "by {number}" or a date
        if (name.includes("at") || name.includes("by") || name.includes("on")) {
            setShowAdvanced(true);
            // get the number or date from the name
            const number = name.match(/\d+/);
            if (number) {
                setSuggestion(number[0]);
            }
        } else {
            setSuggestion("");
        }
    };

    const resetTaskCreation = () => {
        setTaskName("");
        setSuggestion("");
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
        const defaultStartDate = getDefaultStartDate(isBlueprint);
        setStartDate(defaultStartDate);
        setReminders([]);
        setIsPublic(true);
        setIntegration("");
        setFlexDetails(null);
        // Don't reset isBlueprint here as it should persist
        setShowAdvanced(false);
    };

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
        setReminders(
            taskData.reminders?.map((reminder) => ({
                ...reminder,
                triggerTime: new Date(reminder.triggerTime),
            })) || []
        );

        setIsPublic(taskData.public !== undefined ? taskData.public : true);
        setBlueprintStateInternal(taskData.isBlueprint || false);
        setIntegration(taskData.integration || "");
        setFlexDetails(taskData.recurDetails?.flex || null);
    }, []);

    const contextValue = useMemo(() => ({
        taskName,
        setTaskName,
        resetTaskCreation,
        loadTaskData,
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
        setReminders,
        isPublic,
        setIsPublic,
        isBlueprint,
        setIsBlueprint: setIsBlueprintWithStartDate,
        flexDetails,
        setFlexDetails,
        integration,
        setIntegration,
        setPriority,
        setValue,
        setRecurring,
        setRecurFrequency,
        setRecurDetails,
        setDeadline,
        addSmartDeadlineReminders,
        setStartDate,
        setStartTime,
        addSmartStartReminders,
    }), [
        taskName, showAdvanced, suggestion, priority, value,
        recurring, recurFrequency, recurDetails, deadline,
        startTime, startDate, reminders, isPublic, isBlueprint,
        integration, flexDetails, loadTaskData,
    ]);

    return (
        <TaskCreationContext.Provider value={contextValue}>
            {children}
        </TaskCreationContext.Provider>
    );
};

export const useTaskCreation = () => {
    const context = useContext(TaskCreationContext);
    if (context === undefined) {
        throw new Error("useTaskCreation must be used within a TaskCreationProvider");
    }
    return context;
};
