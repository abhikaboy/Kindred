import React, { createContext, useContext, useState } from "react";
import { useReminder, Reminder } from "@/hooks/useReminder";

type TaskCreationContextType = {
    taskName: string;
    setTaskName: (name: string) => void;
    resetTaskCreation: () => void;
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

    const { getDeadlineReminder, getStartDateReminder } = useReminder();

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

    // Wrap setStartDate to auto-add absolute reminder
    const setStartDateWithReminder = (startDate: Date | null) => {
        setStartDate(startDate);
        if (startDate) {
            const reminder = getStartDateReminder(startDate, startTime);
            if (reminder) {
                setReminders((prev) => {
                    // Avoid duplicate reminders for the same triggerTime/type
                    const exists = prev.some(
                        (r) =>
                            r.type === reminder.type &&
                            !r.beforeDeadline &&
                            Math.abs(r.triggerTime.getTime() - reminder.triggerTime.getTime()) < 60000
                    );
                    if (!exists) return [...prev, reminder];
                    return prev;
                });
            }
        }
    };

    // Optionally, update startDate reminder if startTime changes
    const setStartTimeWithReminder = (startTimeVal: Date | null) => {
        setStartTime(startTimeVal);
        if (startDate && startTimeVal) {
            const reminder = getStartDateReminder(startDate, startTimeVal);
            if (reminder) {
                setReminders((prev) => {
                    // Remove old absolute startDate reminders, add new one
                    const filtered = prev.filter((r) => !(r.type === "ABSOLUTE" && !r.beforeDeadline));
                    return [...filtered, reminder];
                });
            }
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

    return (
        <TaskCreationContext.Provider
            value={{
                taskName,
                setTaskName,
                resetTaskCreation,
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
