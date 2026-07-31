import { CalendarBlank, Flag, Sparkle, Stack, X } from "@phosphor-icons/react";
import { describeSchedule, type ParsedRecurrence, type ParsedSchedule } from "@shared/taskSuggest";
import { PropertyPill } from "@/components/create/PropertyPill";
import { PRIORITIES } from "@/components/create/PriorityPopover";
import { ThemedText } from "@/components/ThemedText";
import type { FuzzySuggestion } from "@/hooks/useTaskSuggestions";
import type { TaskFormState } from "@/hooks/useCreateActions";
import type { SelectedCategory } from "@/components/create/types";

/**
 * The two suggestion tiers under the title: a parsed-schedule summary that has
 * already been applied and can be dismissed, and fuzzy chips that apply on click.
 * Renders nothing when there is nothing to show.
 */
export function SuggestionRow({
    form,
    schedule,
    recurrence,
    fuzzy,
    categories,
    selectedCategoryId,
    onApply,
    onSelectCategory,
    onDismiss,
}: {
    form: TaskFormState;
    schedule: ParsedSchedule | null;
    recurrence: ParsedRecurrence | null;
    fuzzy: FuzzySuggestion | null;
    categories: SelectedCategory[];
    selectedCategoryId?: string;
    onApply: (patch: Partial<TaskFormState>) => void;
    onSelectCategory: (category: SelectedCategory) => void;
    onDismiss: () => void;
}) {
    const label = describeSchedule(schedule, recurrence);

    const category = fuzzy?.categoryId ? categories.find((c) => c.id === fuzzy.categoryId) : undefined;
    const showCategory = !!category && category.id !== selectedCategoryId;
    const priority = fuzzy?.priority !== undefined && fuzzy.priority !== form.priority ? fuzzy.priority : undefined;
    const value = fuzzy?.value !== undefined && fuzzy.value !== form.value ? fuzzy.value : undefined;
    const hasChips = showCategory || priority !== undefined || value !== undefined;

    if (!label && !hasChips) return null;

    return (
        <div className="flex flex-col gap-2">
            {label && (
                <div className="flex items-center gap-1.5">
                    <CalendarBlank size={13} className="shrink-0 text-muted-foreground" />
                    <ThemedText type="caption" className="text-muted-foreground">
                        {label}
                    </ThemedText>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Dismiss detected schedule"
                        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                        <X size={11} />
                    </button>
                </div>
            )}

            {hasChips && (
                <div className="flex flex-wrap items-center gap-2">
                    <Sparkle size={13} className="shrink-0 text-muted-foreground" />
                    {showCategory && (
                        <PropertyPill icon={<Stack size={14} />} onClick={() => onSelectCategory(category)}>
                            {category.name}
                        </PropertyPill>
                    )}
                    {priority !== undefined && (
                        <PropertyPill icon={<Flag size={14} />} onClick={() => onApply({ priority })}>
                            {PRIORITIES.find((p) => p.value === priority)?.label ?? `Priority ${priority}`}
                        </PropertyPill>
                    )}
                    {value !== undefined && (
                        <PropertyPill onClick={() => onApply({ value })}>Difficulty {value}</PropertyPill>
                    )}
                </div>
            )}
        </div>
    );
}
