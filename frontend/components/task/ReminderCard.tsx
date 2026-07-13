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

const ReminderCard = ({ reminder, start, deadline }: Props) => {
    const ThemedColor = useThemeColor();
    const relative = reminderRelativeLabel(reminder, { start, deadline });
    const when = `${formatOrdinalDate(reminder.triggerTime)} · ${formatLocalTime(reminder.triggerTime, {
        hour: "numeric",
        minute: "2-digit",
    })}`;

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
                    <ThemedText type="caption">{when}</ThemedText>
                </>
            ) : (
                <ThemedText type="defaultSemiBold">{when}</ThemedText>
            )}
        </View>
    );
};

export default ReminderCard;
