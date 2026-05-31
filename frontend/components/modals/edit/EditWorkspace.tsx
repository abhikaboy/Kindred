import { StyleSheet, Text, View, TouchableOpacity, Keyboard } from "react-native";
import React, { useState, useRef, useCallback, useMemo } from "react";
import BottomMenuModal from "../BottomMenuModal";
import DeleteWorkspaceConfirmationModal from "../DeleteWorkspaceConfirmationModal";
import EditWorkspaceModal from "./EditWorkspaceModal";
import { useTasks } from "@/contexts/tasksContext";
import { deleteWorkspace, setWorkspacePushEnabled } from "@/api/category";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { workspaceStateEvents } from "@/utils/workspaceStateEvents";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ThemedText } from "@/components/ThemedText";
import DefaultCard from "@/components/cards/DefaultCard";
import DraggableFlatList from "react-native-draggable-flatlist";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SortContent, FilterContent } from "@/components/ListControls";
import { sortCategories, SortOption, SortDirection } from "@/utils/categorySort";
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
    actionRequest?: "sort" | "filter" | "group" | null;
    onActionHandled?: () => void;
    skipMenu?: boolean;
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id, actionRequest = null, onActionHandled, skipMenu = false } = props;
    const { removeWorkspace, getWorkspace, restoreWorkspace, workspaces, setWorkSpaces } = useTasks();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<"sort" | "filter" | null>(null);
    const [isPublic, setIsPublic] = useState(true);
    const [groupByDay, setGroupByDay] = useState(false);
    const ThemedColor = useThemeColor();

    // Get the categories for the current workspace
    const currentWorkspace = workspaces.find((ws) => ws.name === id);
    const workspaceCategories = currentWorkspace?.categories || [];

    // Calendar-linked categories (those that have a gcal:* integration string).
    // The "Push to Calendar" workspace toggle only surfaces when at least one exists,
    // and the display state reflects whether all of them are currently push-enabled.
    const calendarCategories = workspaceCategories.filter(
        (c: any) => typeof c.integration === "string" && c.integration.startsWith("gcal:")
    );
    const hasCalendarCategories = calendarCategories.length > 0;
    const pushOn =
        hasCalendarCategories && calendarCategories.every((c: any) => Boolean(c.push_enabled));

    // Reference to the bottom sheet modals
    const editWorkspaceSheetRef = useRef<BottomSheetModal>(null);
    const reorderSheetRef = useRef<BottomSheetModal>(null);
    const sortSheetRef = useRef<BottomSheetModal>(null);
    const filterSheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the modals
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

    React.useEffect(() => {
        const loadGroupBy = async () => {
            try {
                const stored = await AsyncStorage.getItem(`workspace-group-${id}`);
                setGroupByDay(stored === "day");
            } catch (error) {
                console.error("Error loading workspace grouping:", error);
            }
        };
        loadGroupBy();
    }, [id]);

    React.useEffect(() => {
        if (!actionRequest) return;

        if (actionRequest === "sort") {
            setShowSortModal(true);
            sortSheetRef.current?.present();
        }

        if (actionRequest === "filter") {
            setShowFilterModal(true);
            filterSheetRef.current?.present();
        }

        if (actionRequest === "group") {
            handleGroupByDayClick();
        }

        onActionHandled?.();
    }, [actionRequest, onActionHandled]);

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
        setPendingAction("sort");
        setEditing(false);
    };

    const handleFilterClick = () => {
        setPendingAction("filter");
        setEditing(false);
    };

    const handleVisibilityClick = async () => {
        const newValue = !isPublic;
        setIsPublic(newValue);
        try {
            await AsyncStorage.setItem(`workspace-visibility-${id}`, newValue ? "public" : "private");
            workspaceStateEvents.emit(id);
        } catch (error) {
            console.error("Error saving workspace visibility:", error);
        }
    };

    const handlePushToggleClick = async () => {
        if (!hasCalendarCategories) return;
        const next = !pushOn;
        try {
            await setWorkspacePushEnabled(id, next);
            const wsCopy = [...workspaces];
            const idx = wsCopy.findIndex((w) => w.name === id);
            if (idx !== -1) {
                wsCopy[idx] = {
                    ...wsCopy[idx],
                    categories: wsCopy[idx].categories.map((c: any) =>
                        typeof c.integration === "string" && c.integration.startsWith("gcal:")
                            ? { ...c, push_enabled: next }
                            : c
                    ),
                };
                setWorkSpaces(wsCopy);
            }
        } catch (error) {
            console.error("Error toggling workspace push:", error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to update push setting",
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    };

    const handleGroupByDayClick = async () => {
        const newValue = !groupByDay;
        setGroupByDay(newValue);
        try {
            await AsyncStorage.setItem(`workspace-group-${id}`, newValue ? "day" : "none");
            workspaceStateEvents.emit(id);
        } catch (error) {
            console.error("Error saving workspace grouping:", error);
        }
    };

    // Workspace-specific application of a sort: reorder this workspace's
    // categories in global state and invalidate the cache (the tag view, by
    // contrast, derives its order without mutating global state).
    const applyWorkspaceSort = async (option: SortOption, direction: SortDirection) => {
        const workspacesCopy = workspaces.slice();
        const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === id);
        if (workspaceIndex !== -1) {
            workspacesCopy[workspaceIndex] = {
                ...workspacesCopy[workspaceIndex],
                categories: sortCategories(workspacesCopy[workspaceIndex].categories, option, direction),
            };
            setWorkSpaces(workspacesCopy);
            try {
                await AsyncStorage.removeItem(
                    `workspaces_cache_${workspacesCopy[0]?.categories[0]?.tasks[0]?.userID || "default"}`
                );
            } catch (error) {
                console.error("Error invalidating workspaces cache:", error);
            }
        }
    };

    const editIconPickerOpenRef = useRef(false);

    const handleEditIconPickerVisibilityChange = useCallback((open: boolean) => {
        editIconPickerOpenRef.current = open;
        if (open) {
            Keyboard.dismiss();
            requestAnimationFrame(() => {
                editWorkspaceSheetRef.current?.snapToIndex(0);
            });
        } else {
            requestAnimationFrame(() => {
                editWorkspaceSheetRef.current?.snapToIndex(0);
            });
        }
    }, []);

    const handleEditSheetChanges = useCallback(
        (index: number) => {
            if (index === -1) {
                if (editIconPickerOpenRef.current) {
                    requestAnimationFrame(() => {
                        editWorkspaceSheetRef.current?.snapToIndex(0);
                    });
                } else if (showEditModal) {
                    setShowEditModal(false);
                }
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
            label: groupByDay ? "Group by Day • On" : "Group by Day",
            icon: "calendar",
            callback: handleGroupByDayClick,
            labelHighlight: groupByDay ? "On" : undefined,
        },
        {
            label: `Visibility (${isPublic ? "Public" : "Private"})`,
            icon: isPublic ? "eye" : "eye-off",
            callback: handleVisibilityClick,
        },
        ...(hasCalendarCategories
            ? [
                  {
                      label: `Push to Calendar • ${pushOn ? "On" : "Off"}`,
                      icon: "upload-cloud",
                      callback: handlePushToggleClick,
                      labelHighlight: pushOn ? "On" : undefined,
                  },
              ]
            : []),
        { label: "Delete", icon: "trash-2", callback: handleDeleteClick },
    ];

    return (
        <>
            <BottomMenuModal
                id={{ id: "", category: id }}
                visible={editing && !skipMenu}
                setVisible={setEditing}
                onDismiss={() => {
                    if (pendingAction === "sort") {
                        setShowSortModal(true);
                        setTimeout(() => sortSheetRef.current?.present(), 60);
                    }
                    if (pendingAction === "filter") {
                        setShowFilterModal(true);
                        setTimeout(() => filterSheetRef.current?.present(), 60);
                    }
                    if (pendingAction) {
                        setPendingAction(null);
                    }
                }}
                options={options}
            />

            {/* Edit Workspace Bottom Sheet Modal */}
            <BottomSheetModal
                ref={editWorkspaceSheetRef}
                index={0}
                enableDynamicSizing={true}
                onChange={handleEditSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                enablePanDownToClose={true}>
                <BottomSheetView
                    style={{
                        paddingHorizontal: 20,
                        paddingBottom: 32,
                    }}>
                    <EditWorkspaceModal
                        currentName={id}
                        currentIcon={currentWorkspace?.icon}
                        currentColor={currentWorkspace?.color}
                        hide={() => {
                            setShowEditModal(false);
                            editWorkspaceSheetRef.current?.dismiss();
                        }}
                        onIconPickerVisibilityChange={handleEditIconPickerVisibilityChange}
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
                        storageKey={id}
                        onApplySort={applyWorkspaceSort}
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
                        storageKey={id}
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

    const handleSave = async () => {
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

            // ✅ CRITICAL FIX: Invalidate cache after reordering
            try {
                await AsyncStorage.removeItem(`workspaces_cache_${workspacesCopy[0]?.categories[0]?.tasks[0]?.userID || 'default'}`);
                console.log("Workspaces cache invalidated after reorder");
            } catch (error) {
                console.error("Error invalidating workspaces cache:", error);
            }
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
                <PrimaryButton title="Save Order" secondary={!hasChanges} onPress={handleSave} disabled={!hasChanges} />
            </View>
        </>
    );
};


export default EditWorkspace;
