import { View } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatLocalTime, formatOrdinalDate, reminderRelativeLabel } from "@/utils/timeUtils";
import type { Reminder } from "@/api/types";

type Props = {
    reminder: Reminder;
    start?: string | Date | null;
    deadline?: string | Date | null;
};

/** Reminders the backend adds itself, labelled by type instead of a bare time. */
const TYPE_LABELS: Record<string, string> = {
    FOLLOW_UP: "Follow-up",
    PLAN: "Your planned step",
};

const ReminderCard = ({ reminder, start, deadline }: Props) => {
    const ThemedColor = useThemeColor();
    const when = `${formatOrdinalDate(reminder.triggerTime)} · ${formatLocalTime(reminder.triggerTime, {
        hour: "numeric",
        minute: "2-digit",
    })}`;
    // Follow-ups are added on their own, so say so rather than showing a time
    // the user doesn't remember setting.
    const relative = TYPE_LABELS[reminder.type] ?? reminderRelativeLabel(reminder, { start, deadline });
    const caption = reminder.type === "FOLLOW_UP" ? `Automatic · ${when}` : when;

    return (
        <View
            style={{
                backgroundColor: ThemedColor.lightened,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                gap: 2,
            }}>
            {relative ? (
                <>
                    <ThemedText type="defaultSemiBold">{relative}</ThemedText>
                    <ThemedText type="caption">{caption}</ThemedText>
                </>
            ) : (
                <ThemedText type="defaultSemiBold">{when}</ThemedText>
            )}
        </View>
    );
};

export default ReminderCard;
