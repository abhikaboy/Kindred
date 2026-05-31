import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { workspaceStateEvents } from "@/utils/workspaceStateEvents";
import { SortOption, SortDirection } from "@/utils/categorySort";
import {
    ChartBar,
    ChartBarHorizontal,
    CalendarBlank,
    CalendarCheck,
    ArrowRight,
    Minus,
    WarningCircle,
    Hash,
    SortAscending,
    ArrowUp,
    ArrowDown,
} from "phosphor-react-native";

// ============================================================
// Sort
// ============================================================

type SortContentProps = {
    // AsyncStorage scope: workspace name, or `tag:<value>` for the tag view.
    storageKey: string;
    // Host-specific application of the chosen ordering (e.g. the workspace view
    // reorders global state; the tag view re-derives its list). Persistence and
    // the state-change event are handled here regardless.
    onApplySort?: (option: SortOption, direction: SortDirection) => void | Promise<void>;
    onApply: () => void;
};

export const SortContent = ({ storageKey, onApplySort, onApply }: SortContentProps) => {
    const ThemedColor = useThemeColor();
    const [selectedSort, setSelectedSort] = useState<SortOption>("task-count");
    const [sortDirection, setSortDirection] = useState<SortDirection>("descending");

    const handleSort = async () => {
        await onApplySort?.(selectedSort, sortDirection);

        try {
            await Promise.all([
                AsyncStorage.setItem(`workspace-sort-${storageKey}`, selectedSort),
                AsyncStorage.setItem(`workspace-sort-direction-${storageKey}`, sortDirection),
            ]);
            workspaceStateEvents.emit(storageKey);
        } catch (error) {
            console.error("Error saving sort option:", error);
        }

        onApply();
    };

    const handleSortOptionPress = async (option: SortOption) => {
        if (selectedSort === option) {
            if (sortDirection === "descending") {
                setSortDirection("ascending");
                await AsyncStorage.setItem(`workspace-sort-direction-${storageKey}`, "ascending");
                workspaceStateEvents.emit(storageKey);
            } else if (sortDirection === "ascending") {
                setSelectedSort("task-count");
                setSortDirection("descending");
                try {
                    await AsyncStorage.removeItem(`workspace-sort-${storageKey}`);
                    await AsyncStorage.removeItem(`workspace-sort-direction-${storageKey}`);
                    workspaceStateEvents.emit(storageKey);
                } catch (error) {
                    console.error("Error clearing sort:", error);
                }
            }
        } else {
            setSelectedSort(option);
            setSortDirection("descending");
            try {
                await AsyncStorage.setItem(`workspace-sort-${storageKey}`, option);
                await AsyncStorage.setItem(`workspace-sort-direction-${storageKey}`, "descending");
                workspaceStateEvents.emit(storageKey);
            } catch (error) {
                console.error("Error saving sort:", error);
            }
        }
    };

    const SortOptionRow = ({
        option,
        label,
        IconComponent,
    }: {
        option: SortOption;
        label: string;
        IconComponent: React.ComponentType<any>;
    }) => {
        const isSelected = selectedSort === option;
        const textColor = isSelected ? ThemedColor.primary : ThemedColor.text;
        const iconColor = isSelected ? ThemedColor.primary : ThemedColor.text;
        const DirectionIcon = sortDirection === "ascending" ? ArrowUp : ArrowDown;

        return (
            <TouchableOpacity onPress={() => handleSortOptionPress(option)}>
                <View style={styles.sortOptionRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <IconComponent color={iconColor} size={24} weight="regular" />
                        <ThemedText type="default" style={{ color: textColor, fontSize: 16 }}>
                            {label}
                        </ThemedText>
                    </View>
                    {isSelected && <DirectionIcon color={iconColor} size={20} weight="bold" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <ThemedText type="subtitle" style={{ marginBottom: 24 }}>
                Sort By
            </ThemedText>
            <View style={{ flex: 1, gap: 20 }}>
                <View style={{ gap: 8 }}>
                    <SortOptionRow option="task-count" label="Task Count" IconComponent={(props) => <Hash {...props} />} />
                    <SortOptionRow option="alphabetical" label="Alphabetical" IconComponent={(props) => <SortAscending {...props} />} />
                    <SortOptionRow option="due-date" label="Due Date" IconComponent={(props) => <CalendarCheck {...props} />} />
                    <SortOptionRow option="start-date" label="Start Date" IconComponent={(props) => <CalendarBlank {...props} />} />
                    <SortOptionRow option="priority" label="Priority" IconComponent={(props) => <ChartBar {...props} />} />
                </View>

                <PrimaryButton title="Apply Sort" onPress={handleSort} />
            </View>
        </>
    );
};

// ============================================================
// Filter
// ============================================================

type FilterState = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

const EMPTY_FILTERS: FilterState = {
    priorities: { low: false, medium: false, high: false },
    deadlines: { overdue: false, today: false, thisWeek: false, future: false, none: false },
};

export const FilterContent = ({ storageKey, onApply }: { storageKey: string; onApply: () => void }) => {
    const ThemedColor = useThemeColor();
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

    React.useEffect(() => {
        const loadFilters = async () => {
            try {
                const saved = await AsyncStorage.getItem(`workspace-filters-${storageKey}`);
                if (saved) {
                    setFilters(JSON.parse(saved));
                }
            } catch (error) {
                console.error("Error loading filters:", error);
            }
        };
        loadFilters();
    }, [storageKey]);

    const handleClearFilters = async () => {
        setFilters(EMPTY_FILTERS);
        try {
            await AsyncStorage.removeItem(`workspace-filters-${storageKey}`);
            workspaceStateEvents.emit(storageKey);
            showToastable({
                title: "Filters Cleared",
                status: "info",
                position: "top",
                duration: 2000,
                message: "All filters have been removed",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        } catch (error) {
            console.error("Error clearing filters:", error);
        }
    };

    const toggleFilter = async (category: keyof FilterState, option: string) => {
        const newFilters = {
            ...filters,
            [category]: {
                ...filters[category],
                [option]: !filters[category][option],
            },
        };

        setFilters(newFilters);

        try {
            await AsyncStorage.setItem(`workspace-filters-${storageKey}`, JSON.stringify(newFilters));
            workspaceStateEvents.emit(storageKey);
        } catch (error) {
            console.error("Error saving filters:", error);
        }
    };

    const FilterCard = ({
        label,
        isSelected,
        onPress,
        IconComponent,
    }: {
        label: string;
        isSelected: boolean;
        onPress: () => void;
        IconComponent: React.ComponentType<any>;
    }) => {
        const iconColor = isSelected ? ThemedColor.primary : ThemedColor.text;

        return (
            <TouchableOpacity onPress={onPress} style={styles.filterCardWrapper}>
                <View
                    style={[
                        styles.filterCard,
                        {
                            backgroundColor: ThemedColor.lightenedCard,
                            borderWidth: isSelected ? 2 : 0,
                            borderColor: isSelected ? ThemedColor.primary : "transparent",
                        },
                    ]}>
                    <View style={styles.filterIconContainer}>
                        <IconComponent color={iconColor} />
                    </View>
                    <ThemedText type="default" style={{ fontSize: 15, textAlign: "center", color: iconColor }}>
                        {label}
                    </ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    const hasActiveFilters =
        Object.values(filters.priorities).some((v) => v) || Object.values(filters.deadlines).some((v) => v);

    return (
        <>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                Filters
            </ThemedText>
            <View style={{ flex: 1, gap: 24 }}>
                <View style={{ gap: 12 }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Priority Level
                    </ThemedText>
                    <View style={styles.filterGrid}>
                        <FilterCard label="Low" isSelected={filters.priorities.low} onPress={() => toggleFilter("priorities", "low")} IconComponent={(props) => <ChartBarHorizontal size={28} weight="regular" {...props} />} />
                        <FilterCard label="Medium" isSelected={filters.priorities.medium} onPress={() => toggleFilter("priorities", "medium")} IconComponent={(props) => <ChartBar size={28} weight="regular" {...props} />} />
                        <FilterCard label="High" isSelected={filters.priorities.high} onPress={() => toggleFilter("priorities", "high")} IconComponent={(props) => <ChartBar size={28} weight="fill" {...props} />} />
                    </View>
                </View>

                <View style={{ gap: 12 }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Deadline
                    </ThemedText>
                    <View style={styles.filterGrid}>
                        <FilterCard label="Overdue" isSelected={filters.deadlines.overdue} onPress={() => toggleFilter("deadlines", "overdue")} IconComponent={(props) => <WarningCircle size={28} weight="regular" {...props} />} />
                        <FilterCard label="Today" isSelected={filters.deadlines.today} onPress={() => toggleFilter("deadlines", "today")} IconComponent={(props) => <CalendarCheck size={28} weight="regular" {...props} />} />
                        <FilterCard label="This Week" isSelected={filters.deadlines.thisWeek} onPress={() => toggleFilter("deadlines", "thisWeek")} IconComponent={(props) => <CalendarBlank size={28} weight="regular" {...props} />} />
                        <FilterCard label="Future" isSelected={filters.deadlines.future} onPress={() => toggleFilter("deadlines", "future")} IconComponent={(props) => <ArrowRight size={28} weight="regular" {...props} />} />
                        <FilterCard label="No Deadline" isSelected={filters.deadlines.none} onPress={() => toggleFilter("deadlines", "none")} IconComponent={(props) => <Minus size={28} weight="bold" {...props} />} />
                    </View>
                </View>

                {hasActiveFilters && (
                    <View style={{ marginTop: "auto", paddingBottom: 8 }}>
                        <TouchableOpacity onPress={handleClearFilters}>
                            <ThemedText type="default" style={{ textAlign: "center", color: ThemedColor.caption }}>
                                Clear All Filters
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    sortOptionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    filterGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    filterCardWrapper: {
        width: "31%",
        minWidth: 100,
    },
    filterCard: {
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 100,
        position: "relative",
    },
    filterIconContainer: {
        marginBottom: 4,
    },
});
