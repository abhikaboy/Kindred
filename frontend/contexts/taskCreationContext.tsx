import React, { createContext, useContext, useState } from "react";
import { useReminder, Reminder } from "@/hooks/useReminder";

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
    setStartTime: (startTime: Date | null) => void;
    setStartDate: (startDate: Date | null) => void;
};

const TaskCreationContext = createContext<TaskCreationContextType | undefined>(undefined);

export const TaskCreationProvider = ({ children }: { children: React.ReactNode }) => {
    const [taskName, setTaskNameState] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [suggestion, setSuggestion] = useState("");
    const [priority, setPriority] = useState(1);
    const [value, setValue] = useState(3);
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
    const [isPublic, setIsPublic] = useState(false);

    const { getDeadlineReminder, getStartDateReminder, getStartTimeReminder } = useReminder();

    // Wrap setDeadline to auto-add 1h-before reminder
    const setDeadlineWithReminder = (deadline: Date | null) => {
        setDeadline(deadline);
        if (deadline) {
            const reminder = getDeadlineReminder(deadline);
            if (reminder) {
                setReminders((prev) => {
                    // Avoid duplicate reminders for the same triggerTime/type
                    const exists = prev.some(
                        (r) =>
                            r.type === reminder.type &&
                            r.beforeDeadline &&
                            Math.abs(r.triggerTime.getTime() - reminder.triggerTime.getTime()) < 60000
                    );
                    if (!exists) return [...prev, reminder];
                    return prev;
                });
            }
        }
    };

    // Wrap setStartDate to auto-add absolute reminder and 15-min before reminder
    const setStartDateWithReminder = (startDate: Date | null) => {
        setStartDate(startDate);
        if (startDate) {
            const atStartReminder = getStartDateReminder(startDate, startTime);
            const beforeStartReminder = getStartTimeReminder(startDate, startTime);
            
            setReminders((prev) => {
                let newReminders = [...prev];
                
                // Add "at start time" reminder
                if (atStartReminder) {
                    const existsAtStart = prev.some(
                        (r) =>
                            r.type === atStartReminder.type &&
                            !r.beforeDeadline &&
                            !r.beforeStart &&
                            Math.abs(r.triggerTime.getTime() - atStartReminder.triggerTime.getTime()) < 60000
                    );
                    if (!existsAtStart) newReminders.push(atStartReminder);
                }
                
                // Add "15 minutes before start" reminder
                if (beforeStartReminder) {
                    const existsBeforeStart = prev.some(
                        (r) =>
                            r.beforeStart &&
                            Math.abs(r.triggerTime.getTime() - beforeStartReminder.triggerTime.getTime()) < 60000
                    );
                    if (!existsBeforeStart) newReminders.push(beforeStartReminder);
                }
                
                return newReminders;
            });
        }
    };

    // Optionally, update startDate reminder if startTime changes
    const setStartTimeWithReminder = (startTimeVal: Date | null) => {
        setStartTime(startTimeVal);
        if (startDate && startTimeVal) {
            const atStartReminder = getStartDateReminder(startDate, startTimeVal);
            const beforeStartReminder = getStartTimeReminder(startDate, startTimeVal);
            
            setReminders((prev) => {
                // Remove old start-time related reminders
                const filtered = prev.filter((r) => 
                    !(r.type === "ABSOLUTE" && !r.beforeDeadline && !r.beforeStart) && // Remove old "at start" reminders
                    !r.beforeStart // Remove old "before start" reminders
                );
                
                const newReminders = [...filtered];
                
                // Add updated "at start time" reminder
                if (atStartReminder) {
                    newReminders.push(atStartReminder);
                }
                
                // Add updated "15 minutes before start" reminder
                if (beforeStartReminder) {
                    newReminders.push(beforeStartReminder);
                }
                
                return newReminders;
            });
        }
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
        setValue(3);
        setRecurring(false);
        setRecurFrequency("");
        setRecurDetails({
            every: 1,
            daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
            behavior: "ROLLING",
        });
        setDeadline(null);
        setStartTime(null);
        setStartDate(null);
        setReminders([]);
        setIsPublic(false);
        setShowAdvanced(false);
    };

    const loadTaskData = (taskData: any) => {
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
        
        setDeadline(taskData.deadline ? new Date(taskData.deadline) : null);
        setStartTime(taskData.startTime ? new Date(taskData.startTime) : null);
        setStartDate(taskData.startDate ? new Date(taskData.startDate) : null);
        setReminders(taskData.reminders?.map(reminder => ({
            ...reminder,
            triggerTime: new Date(reminder.triggerTime)
        })) || []);
        setIsPublic(taskData.public || false);
    };

    return (
        <TaskCreationContext.Provider
            value={{
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
                setPriority,
                setValue,
                setRecurring,
                setRecurFrequency,
                setRecurDetails,
                setDeadline: setDeadlineWithReminder,
                setStartDate: setStartDateWithReminder,
                setStartTime: setStartTimeWithReminder,
            }}>
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
