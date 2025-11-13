import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import React, { useState, useRef, useCallback, useMemo } from "react";
import BottomMenuModal from "../BottomMenuModal";
import DeleteWorkspaceConfirmationModal from "../DeleteWorkspaceConfirmationModal";
import EditWorkspaceModal from "./EditWorkspaceModal";
import { useTasks } from "@/contexts/tasksContext";
import { deleteWorkspace } from "@/api/category";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ThemedText } from "@/components/ThemedText";
import DefaultCard from "@/components/cards/DefaultCard";
import DraggableFlatList from "react-native-draggable-flatlist";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { isToday, isThisWeek, isFuture, isPast, startOfWeek, endOfWeek } from "date-fns";
import {
    ChartBar,
    ChartBarHorizontal,
    CheckCircle,
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

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string; // This is the workspace name
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id } = props;
    const { removeWorkspace, getWorkspace, restoreWorkspace, workspaces } = useTasks();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const ThemedColor = useThemeColor();

    // Get the categories for the current workspace
    const currentWorkspace = workspaces.find((ws) => ws.name === id);
    const workspaceCategories = currentWorkspace?.categories || [];

    // Reference to the bottom sheet modals
    const editWorkspaceSheetRef = useRef<BottomSheetModal>(null);
    const reorderSheetRef = useRef<BottomSheetModal>(null);
    const sortSheetRef = useRef<BottomSheetModal>(null);
    const filterSheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the modals
    const editSnapPoints = useMemo(() => ["30%"], []);
    const reorderSnapPoints = useMemo(() => ["70%"], []);
    const sortSnapPoints = useMemo(() => ["40%"], []);
    const filterSnapPoints = useMemo(() => ["50%"], []);

    // Load visibility preference from local storage
    React.useEffect(() => {
        const loadVisibility = async () => {
            try {
                const stored = await AsyncStorage.getItem(`workspace-visibility-${id}`);
                if (stored !== null) {
                    setIsPublic(stored === "public");
                }
            } catch (error) {
                console.error("Error loading workspace visibility:", error);
            }
        };
        loadVisibility();
    }, [id]);

    const handleDeleteWorkspace = async () => {
        // Store the workspace data for potential rollback
        const workspaceToDelete = getWorkspace(id);

        // Optimistic update - immediately update the UI
        removeWorkspace(id);

        // Close the modal immediately for better UX
        setShowDeleteConfirmation(false);

        try {
            // Call the API to delete the workspace
            await deleteWorkspace(id);

            // Show success toast
            showToastable({
                title: "Workspace deleted!",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: `Workspace "${id}" has been deleted successfully`,
                renderContent: (props) => <DefaultToast {...props} />,
            });

            setEditing(false);
        } catch (error) {
            console.error("Error deleting workspace:", error);

            // Rollback the optimistic update on error
            if (workspaceToDelete) {
                restoreWorkspace(workspaceToDelete);
            }

            // Show error toast
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to delete workspace. Please try again.",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirmation(true);
        setEditing(false); // Close the edit menu
    };

    const handleEditClick = () => {
        setShowEditModal(true);
        setEditing(false); // Close the edit menu
        editWorkspaceSheetRef.current?.present();
    };

    const handleReorderClick = () => {
        setShowReorderModal(true);
        setEditing(false);
        reorderSheetRef.current?.present();
    };

    const handleSortClick = () => {
        setShowSortModal(true);
        setEditing(false);
        sortSheetRef.current?.present();
    };

    const handleFilterClick = () => {
        setShowFilterModal(true);
        setEditing(false);
        filterSheetRef.current?.present();
    };

    const handleVisibilityClick = async () => {
        const newValue = !isPublic;
        setIsPublic(newValue);
        try {
            await AsyncStorage.setItem(`workspace-visibility-${id}`, newValue ? "public" : "private");
        } catch (error) {
            console.error("Error saving workspace visibility:", error);
        }
    };

    const handleEditSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && showEditModal) {
                setShowEditModal(false);
            }
        },
        [showEditModal]
    );

    const handleReorderSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && showReorderModal) {
                setShowReorderModal(false);
            }
        },
        [showReorderModal]
    );

    const handleSortSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && showSortModal) {
                setShowSortModal(false);
            }
        },
        [showSortModal]
    );

    const handleFilterSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && showFilterModal) {
                setShowFilterModal(false);
            }
        },
        [showFilterModal]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    // Calculate active filter count
    const [activeFilterCount, setActiveFilterCount] = React.useState(0);
    const [currentSort, setCurrentSort] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadFilterAndSortInfo = async () => {
            try {
                const [filtersData, sortData] = await Promise.all([
                    AsyncStorage.getItem(`workspace-filters-${id}`),
                    AsyncStorage.getItem(`workspace-sort-${id}`),
                ]);

                if (filtersData) {
                    const filters = JSON.parse(filtersData);
                    const count =
                        Object.values(filters.priorities).filter((v: any) => v).length +
                        Object.values(filters.deadlines).filter((v: any) => v).length;
                    setActiveFilterCount(count);
                } else {
                    setActiveFilterCount(0);
                }

                if (sortData) {
                    setCurrentSort(sortData);
                } else {
                    setCurrentSort(null);
                }
            } catch (error) {
                console.error("Error loading filter/sort info:", error);
            }
        };

        loadFilterAndSortInfo();
    }, [id, showFilterModal, showSortModal]);

    const getSortLabel = () => {
        if (!currentSort) return "Sort";
        const labels: Record<string, string> = {
            "task-count": "Task Count",
            alphabetical: "Alphabetical",
            "due-date": "Due Date",
            "start-date": "Start Date",
            priority: "Priority",
        };
        return `Sort • ${labels[currentSort] || currentSort}`;
    };

    const options = [
        { label: "Edit", icon: "edit", callback: handleEditClick },
        { label: "Reorder", icon: "list", callback: handleReorderClick },
        {
            label: getSortLabel(),
            icon: "filter",
            callback: handleSortClick,
        },
        {
            label: activeFilterCount > 0 ? `Filter • ${activeFilterCount} active` : "Filter",
            icon: "sliders",
            callback: handleFilterClick,
            labelHighlight: activeFilterCount > 0 ? `${activeFilterCount} active` : undefined,
        },
        {
            label: `Visibility (${isPublic ? "Public" : "Private"})`,
            icon: isPublic ? "eye" : "eye-off",
            callback: handleVisibilityClick,
        },
        { label: "Delete", icon: "trash-2", callback: handleDeleteClick },
    ];

    return (
        <>
            <BottomMenuModal
                id={{ id: "", category: id }}
                visible={editing}
                setVisible={setEditing}
                options={options}
            />

            {/* Edit Workspace Bottom Sheet Modal */}
            <BottomSheetModal
                ref={editWorkspaceSheetRef}
                index={0}
                snapPoints={editSnapPoints}
                onChange={handleEditSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView
                    style={{
                        paddingHorizontal: 20,
                    }}>
                    <EditWorkspaceModal
                        currentName={id}
                        hide={() => {
                            setShowEditModal(false);
                            editWorkspaceSheetRef.current?.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>

            {/* Reorder Bottom Sheet */}
            <BottomSheetModal
                ref={reorderSheetRef}
                index={0}
                snapPoints={reorderSnapPoints}
                onChange={handleReorderSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 20, flex: 1 }}>
                    <ReorderContent
                        categories={workspaceCategories}
                        onSave={() => {
                            setShowReorderModal(false);
                            reorderSheetRef.current?.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>

            {/* Sort Bottom Sheet */}
            <BottomSheetModal
                ref={sortSheetRef}
                index={0}
                snapPoints={sortSnapPoints}
                onChange={handleSortSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 20, flex: 1 }}>
                    <SortContent
                        onApply={() => {
                            setShowSortModal(false);
                            sortSheetRef.current?.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>

            {/* Filter Bottom Sheet */}
            <BottomSheetModal
                ref={filterSheetRef}
                index={0}
                snapPoints={filterSnapPoints}
                onChange={handleFilterSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 20, flex: 1 }}>
                    <FilterContent
                        workspaceName={id}
                        onApply={() => {
                            setShowFilterModal(false);
                            filterSheetRef.current?.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>

            <DeleteWorkspaceConfirmationModal
                visible={showDeleteConfirmation}
                setVisible={setShowDeleteConfirmation}
                workspaceName={id}
                onConfirm={handleDeleteWorkspace}
                onCancel={() => setShowDeleteConfirmation(false)}
            />
        </>
    );
};

// Reorder Content Component
const ReorderContent = ({ categories, onSave }: { categories: any[]; onSave: () => void }) => {
    const { setWorkSpaces, workspaces, selected } = useTasks();
    const [reorderedCategories, setReorderedCategories] = useState<any[]>(categories);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = () => {
        // Create a proper copy of workspaces array
        const workspacesCopy = [...workspaces];
        const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);

        if (workspaceIndex !== -1) {
            // Create a new workspace object with updated categories
            workspacesCopy[workspaceIndex] = {
                ...workspacesCopy[workspaceIndex],
                categories: reorderedCategories,
            };
            setWorkSpaces(workspacesCopy);
        }

        onSave();
        setHasChanges(false);
    };

    const ThemedColor = useThemeColor();

    return (
        <>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,

                    gap: 12,
                }}>
                <ThemedText type="subtitle">Reorder Categories</ThemedText>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(100, 100, 255, 0.1)",
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 20,
                        gap: 8,
                    }}>
                    <Feather name="trending-up" size={20} color={ThemedColor.primary} />
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 14, opacity: 0.8 }}>
                        In Development
                    </ThemedText>
                </View>
            </View>

            <View style={{ flex: 1, gap: 16 }}>
                <ThemedText type="lightBody">Long press and drag to reorder categories</ThemedText>
                <View style={{ flex: 1 }}>
                    <DraggableFlatList
                        data={reorderedCategories}
                        onDragBegin={() => {
                            setHasChanges(true);
                        }}
                        onDragEnd={({ data }) => {
                            setReorderedCategories(data);
                            setHasChanges(true);
                        }}
                        renderItem={({ item, drag, isActive }) => (
                            <TouchableOpacity
                                key={item.id}
                                onLongPress={drag}
                                style={{
                                    opacity: isActive ? 0.5 : 1,
                                    transform: [{ scale: isActive ? 0.95 : 1 }],
                                }}>
                                <DefaultCard key={item.id}>
                                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                                </DefaultCard>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item.id}
                    />
                </View>
                <PrimaryButton title="Save Order" outline={!hasChanges} onPress={handleSave} disabled={!hasChanges} />
            </View>
        </>
    );
};

// Sort Content Component
type SortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority";
type SortDirection = "ascending" | "descending";

const SortContent = ({ onApply }: { onApply: () => void }) => {
    const ThemedColor = useThemeColor();
    const { setWorkSpaces, workspaces, selected } = useTasks();
    const [selectedSort, setSelectedSort] = useState<SortOption>("task-count");
    const [sortDirection, setSortDirection] = useState<SortDirection>("descending");

    const handleSort = async () => {
        const workspacesCopy = workspaces.slice();
        const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);

        if (workspaceIndex !== -1) {
            const categories = [...workspacesCopy[workspaceIndex].categories];
            const isAscending = sortDirection === "ascending";

            let sortedCategories;
            switch (selectedSort) {
                case "task-count":
                    sortedCategories = categories.sort((a, b) =>
                        isAscending ? a.tasks.length - b.tasks.length : b.tasks.length - a.tasks.length
                    );
                    break;
                case "alphabetical":
                    sortedCategories = categories.sort((a, b) =>
                        isAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    );
                    break;
                case "due-date":
                    // Sort by earliest due date in category (tasks with deadlines)
                    sortedCategories = categories.sort((a, b) => {
                        const aEarliestDeadline =
                            a.tasks
                                .filter((t) => t.deadline)
                                .map((t) => new Date(t.deadline).getTime())
                                .sort((x, y) => x - y)[0] || Infinity;
                        const bEarliestDeadline =
                            b.tasks
                                .filter((t) => t.deadline)
                                .map((t) => new Date(t.deadline).getTime())
                                .sort((x, y) => x - y)[0] || Infinity;
                        return isAscending
                            ? aEarliestDeadline - bEarliestDeadline
                            : bEarliestDeadline - aEarliestDeadline;
                    });
                    break;
                case "start-date":
                    // Sort by earliest start date in category
                    sortedCategories = categories.sort((a, b) => {
                        const aEarliestStart =
                            a.tasks
                                .filter((t) => t.startDate)
                                .map((t) => new Date(t.startDate).getTime())
                                .sort((x, y) => x - y)[0] || Infinity;
                        const bEarliestStart =
                            b.tasks
                                .filter((t) => t.startDate)
                                .map((t) => new Date(t.startDate).getTime())
                                .sort((x, y) => x - y)[0] || Infinity;
                        return isAscending ? aEarliestStart - bEarliestStart : bEarliestStart - aEarliestStart;
                    });
                    break;
                case "priority":
                    // Sort by highest priority in category (high=3, medium=2, low=1, none=0)
                    sortedCategories = categories.sort((a, b) => {
                        const priorityMap: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
                        const aHighestPriority = Math.max(...a.tasks.map((t) => priorityMap[t.priority] || 0), 0);
                        const bHighestPriority = Math.max(...b.tasks.map((t) => priorityMap[t.priority] || 0), 0);
                        return isAscending ? aHighestPriority - bHighestPriority : bHighestPriority - aHighestPriority;
                    });
                    break;
                default:
                    sortedCategories = categories;
            }

            workspacesCopy[workspaceIndex].categories = sortedCategories;
            setWorkSpaces(workspacesCopy);
        }

        // Save sort option and direction to AsyncStorage
        try {
            await Promise.all([
                AsyncStorage.setItem(`workspace-sort-${selected}`, selectedSort),
                AsyncStorage.setItem(`workspace-sort-direction-${selected}`, sortDirection),
            ]);
        } catch (error) {
            console.error("Error saving sort option:", error);
        }

        onApply();
    };

    const handleSortOptionPress = async (option: SortOption) => {
        if (selectedSort === option) {
            // Cycle through: descending → ascending → none (deselect)
            if (sortDirection === "descending") {
                setSortDirection("ascending");
                // Save immediately
                await AsyncStorage.setItem(`workspace-sort-direction-${selected}`, "ascending");
            } else if (sortDirection === "ascending") {
                // Deselect - clear sort
                setSelectedSort("task-count" as SortOption); // Reset to default
                setSortDirection("descending");
                try {
                    await AsyncStorage.removeItem(`workspace-sort-${selected}`);
                    await AsyncStorage.removeItem(`workspace-sort-direction-${selected}`);
                } catch (error) {
                    console.error("Error clearing sort:", error);
                }
            }
        } else {
            // New selection, start with descending
            setSelectedSort(option);
            setSortDirection("descending");
            // Save immediately
            try {
                await AsyncStorage.setItem(`workspace-sort-${selected}`, option);
                await AsyncStorage.setItem(`workspace-sort-direction-${selected}`, "descending");
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
                {/* Sort Options */}
                <View style={{ gap: 8 }}>
                    <SortOptionRow
                        option="task-count"
                        label="Task Count"
                        IconComponent={(props) => <Hash {...props} />}
                    />
                    <SortOptionRow
                        option="alphabetical"
                        label="Alphabetical"
                        IconComponent={(props) => <SortAscending {...props} />}
                    />
                    <SortOptionRow
                        option="due-date"
                        label="Due Date"
                        IconComponent={(props) => <CalendarCheck {...props} />}
                    />
                    <SortOptionRow
                        option="start-date"
                        label="Start Date"
                        IconComponent={(props) => <CalendarBlank {...props} />}
                    />
                    <SortOptionRow
                        option="priority"
                        label="Priority"
                        IconComponent={(props) => <ChartBar {...props} />}
                    />
                </View>

                <PrimaryButton title="Apply Sort" onPress={handleSort} />
            </View>
        </>
    );
};

// Filter Content Component
type FilterState = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

const FilterContent = ({ workspaceName, onApply }: { workspaceName: string; onApply: () => void }) => {
    const ThemedColor = useThemeColor();
    const [filters, setFilters] = useState<FilterState>({
        priorities: { low: false, medium: false, high: false },
        deadlines: { overdue: false, today: false, thisWeek: false, future: false, none: false },
    });

    // Load saved filters from AsyncStorage on mount
    React.useEffect(() => {
        const loadFilters = async () => {
            try {
                const saved = await AsyncStorage.getItem(`workspace-filters-${workspaceName}`);
                if (saved) {
                    setFilters(JSON.parse(saved));
                }
            } catch (error) {
                console.error("Error loading filters:", error);
            }
        };
        loadFilters();
    }, [workspaceName]);

    const handleApply = async () => {
        try {
            // Save filters to AsyncStorage
            await AsyncStorage.setItem(`workspace-filters-${workspaceName}`, JSON.stringify(filters));

            showToastable({
                title: "Filters Applied",
                status: "success",
                position: "top",
                duration: 2000,
                message: "Task filters have been applied to this workspace",
                renderContent: (props) => <DefaultToast {...props} />,
            });

            onApply();
        } catch (error) {
            console.error("Error saving filters:", error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to apply filters",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };

    const handleClearFilters = async () => {
        const clearedFilters = {
            priorities: { low: false, medium: false, high: false },
            deadlines: { overdue: false, today: false, thisWeek: false, future: false, none: false },
        };
        setFilters(clearedFilters);

        try {
            await AsyncStorage.removeItem(`workspace-filters-${workspaceName}`);
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

        // Save immediately to AsyncStorage
        try {
            await AsyncStorage.setItem(`workspace-filters-${workspaceName}`, JSON.stringify(newFilters));
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
                    <ThemedText
                        type="default"
                        style={{
                            fontSize: 15,
                            textAlign: "center",
                            color: iconColor,
                        }}>
                        {label}
                    </ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    const hasActiveFilters =
        Object.values(filters.priorities).some((v) => v) || Object.values(filters.deadlines).some((v) => v);

    const activeFilterCount =
        Object.values(filters.priorities).filter((v) => v).length +
        Object.values(filters.deadlines).filter((v) => v).length;

    return (
        <>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                Filters
            </ThemedText>
            <View style={{ flex: 1, gap: 24 }}>
                {/* Priority Level */}
                <View style={{ gap: 12 }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Priority Level
                    </ThemedText>
                    <View style={styles.filterGrid}>
                        <FilterCard
                            label="Low"
                            isSelected={filters.priorities.low}
                            onPress={() => toggleFilter("priorities", "low")}
                            IconComponent={(props) => <ChartBarHorizontal size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="Medium"
                            isSelected={filters.priorities.medium}
                            onPress={() => toggleFilter("priorities", "medium")}
                            IconComponent={(props) => <ChartBar size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="High"
                            isSelected={filters.priorities.high}
                            onPress={() => toggleFilter("priorities", "high")}
                            IconComponent={(props) => <ChartBar size={28} weight="fill" {...props} />}
                        />
                    </View>
                </View>

                {/* Deadline */}
                <View style={{ gap: 12 }}>
                    <ThemedText type="default" style={{ fontSize: 16 }}>
                        Deadline
                    </ThemedText>
                    <View style={styles.filterGrid}>
                        <FilterCard
                            label="Overdue"
                            isSelected={filters.deadlines.overdue}
                            onPress={() => toggleFilter("deadlines", "overdue")}
                            IconComponent={(props) => <WarningCircle size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="Today"
                            isSelected={filters.deadlines.today}
                            onPress={() => toggleFilter("deadlines", "today")}
                            IconComponent={(props) => <CalendarCheck size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="This Week"
                            isSelected={filters.deadlines.thisWeek}
                            onPress={() => toggleFilter("deadlines", "thisWeek")}
                            IconComponent={(props) => <CalendarBlank size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="Future"
                            isSelected={filters.deadlines.future}
                            onPress={() => toggleFilter("deadlines", "future")}
                            IconComponent={(props) => <ArrowRight size={28} weight="regular" {...props} />}
                        />
                        <FilterCard
                            label="No Deadline"
                            isSelected={filters.deadlines.none}
                            onPress={() => toggleFilter("deadlines", "none")}
                            IconComponent={(props) => <Minus size={28} weight="bold" {...props} />}
                        />
                    </View>
                </View>

                {/* Action Buttons */}
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

export default EditWorkspace;

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
