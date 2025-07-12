import { useCallback } from "react";
import { sub } from "date-fns";
import { combineDateAndTime } from "@/utils/timeUtils";
// Define Reminder type locally since types.d.ts is not a module
export type Reminder = {
    triggerTime: Date;
    type: string;
    sent: boolean;
    afterStart: boolean;
    beforeStart: boolean;
    beforeDeadline: boolean;
    afterDeadline: boolean;
};

// Returns a reminder 1 hour before the deadline
export function useReminder() {
    // 1 hour before deadline
    const getDeadlineReminder = useCallback((deadline: Date | null): Reminder | null => {
        if (!deadline) return null;
        const triggerTime = sub(new Date(deadline), { hours: 1 });
        return {
            triggerTime,
            type: "RELATIVE",
            sent: false,
            afterStart: false,
            beforeStart: false,
            beforeDeadline: true,
            afterDeadline: false,
        };
    }, []);

    // Absolute reminder at startDate (+ startTime if provided)
    const getStartDateReminder = useCallback((startDate: Date | null, startTime?: Date | null): Reminder | null => {
        if (!startDate) return null;
        let triggerTime = new Date(startDate);
        if (startTime) {
            triggerTime = combineDateAndTime(startDate, startTime);
        }
        return {
            triggerTime,
            type: "ABSOLUTE",
            sent: false,
            afterStart: false,
            beforeStart: false,
            beforeDeadline: false,
            afterDeadline: false,
        };
    }, []);

    return { getDeadlineReminder, getStartDateReminder };
}
