import React from "react";
import { TouchableOpacity, View } from "react-native";
import { CalendarBlank, X } from "phosphor-react-native";
import { describeSchedule, type ParsedRecurrence, type ParsedSchedule } from "@shared/taskSuggest";
import { ThemedText } from "@/components/ThemedText";
import SuggestedTag from "@/components/inputs/SuggestedTag";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { TaskFieldSuggestion } from "@/api/task";

const PRIORITY_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };

type Props = {
    schedule: ParsedSchedule | null;
    recurrence: ParsedRecurrence | null;
    fuzzy: TaskFieldSuggestion | null;
    categoryName?: string;
    showCategory: boolean;
    priority?: number;
    value?: number;
    onApplyCategory: () => void;
    onApplyPriority: (priority: number) => void;
    onApplyValue: (value: number) => void;
    onDismiss: () => void;
};

/**
 * The two suggestion tiers under the title: a parsed-schedule summary that has
 * already been applied and can be dismissed, and chips that apply on tap.
 * Renders nothing when there is nothing to show.
 */
const SuggestionRow = ({
    schedule,
    recurrence,
    fuzzy,
    categoryName,
    showCategory,
    priority,
    value,
    onApplyCategory,
    onApplyPriority,
    onApplyValue,
    onDismiss,
}: Props) => {
    const ThemedColor = useThemeColor();
    const label = describeSchedule(schedule, recurrence);
    const hasChips = (showCategory && !!categoryName) || priority !== undefined || value !== undefined;

    if (!label && !hasChips) return null;

    return (
        <View style={{ gap: 8 }}>
            {!!label && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CalendarBlank size={14} color={ThemedColor.caption} />
                    <ThemedText type="caption" style={{ flexShrink: 1 }}>
                        {label}
                    </ThemedText>
                    <TouchableOpacity
                        onPress={onDismiss}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss detected schedule"
                        hitSlop={10}>
                        <X size={12} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </View>
            )}

            {hasChips && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {showCategory && !!categoryName && <SuggestedTag tag={categoryName} onPress={onApplyCategory} />}
                    {priority !== undefined && (
                        <SuggestedTag
                            tag={PRIORITY_LABELS[priority] ?? `Priority ${priority}`}
                            onPress={() => onApplyPriority(priority)}
                        />
                    )}
                    {value !== undefined && (
                        <SuggestedTag tag={`Difficulty ${value}`} onPress={() => onApplyValue(value)} />
                    )}
                </View>
            )}
        </View>
    );
};

export default SuggestionRow;
