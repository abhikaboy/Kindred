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

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string; // This is the workspace name
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id } = props;
    const { removeWorkspace, getWorkspace, restoreWorkspace, categories } = useTasks();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modals
    const editWorkspaceSheetRef = useRef<BottomSheetModal>(null);
    const reorderSheetRef = useRef<BottomSheetModal>(null);
    const sortSheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the modals
    const editSnapPoints = useMemo(() => ["30%"], []);
    const reorderSnapPoints = useMemo(() => ["70%"], []);
    const sortSnapPoints = useMemo(() => ["40%"], []);

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

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    const options = [
        { label: "Edit", icon: "edit", callback: handleEditClick },
        { label: "Reorder", icon: "list", callback: handleReorderClick },
        { label: "Sort", icon: "filter", callback: handleSortClick },
        { label: `Visibility (${isPublic ? "Public" : "Private"})`, icon: isPublic ? "eye" : "eye-off", callback: handleVisibilityClick },
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
                        categories={categories}
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
    const [reordering, setReordering] = useState(false);

    const handleSave = () => {
        // Update the workspace with the new category order
        const workspacesCopy = workspaces.slice();
        const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);
        
        if (workspaceIndex !== -1) {
            workspacesCopy[workspaceIndex].categories = reorderedCategories;
            setWorkSpaces(workspacesCopy);
        }
        
        onSave();
        setReordering(false);
    };

    return (
        <>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                Reorder Categories
            </ThemedText>
            <View style={{ flex: 1, gap: 16 }}>
                <ThemedText type="lightBody">
                    Long press and drag to reorder categories
                </ThemedText>
                <View style={{ flex: 1 }}>
                    <DraggableFlatList
                        data={reorderedCategories}
                        onDragBegin={() => {
                            setReordering(true);
                        }}
                        onDragEnd={({ data }) => {
                            setReorderedCategories(data);
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
                <PrimaryButton
                    title="Save Reordering"
                    outline={!reordering}
                    onPress={handleSave}
                />
            </View>
        </>
    );
};

// Sort Content Component
type SortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority";

const SortContent = ({ onApply }: { onApply: () => void }) => {
    const ThemedColor = useThemeColor();
    const { setWorkSpaces, workspaces, selected } = useTasks();
    const [selectedSort, setSelectedSort] = useState<SortOption>("task-count");

    const handleSort = () => {
        const workspacesCopy = workspaces.slice();
        const workspaceIndex = workspacesCopy.findIndex((ws) => ws.name === selected);
        
        if (workspaceIndex !== -1) {
            const categories = [...workspacesCopy[workspaceIndex].categories];
            
            let sortedCategories;
            switch (selectedSort) {
                case "task-count":
                    sortedCategories = categories.sort((a, b) => b.tasks.length - a.tasks.length);
                    break;
                case "alphabetical":
                    sortedCategories = categories.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case "due-date":
                    // Sort by earliest due date in category (tasks with deadlines)
                    sortedCategories = categories.sort((a, b) => {
                        const aEarliestDeadline = a.tasks
                            .filter(t => t.deadline)
                            .map(t => new Date(t.deadline).getTime())
                            .sort((x, y) => x - y)[0] || Infinity;
                        const bEarliestDeadline = b.tasks
                            .filter(t => t.deadline)
                            .map(t => new Date(t.deadline).getTime())
                            .sort((x, y) => x - y)[0] || Infinity;
                        return aEarliestDeadline - bEarliestDeadline;
                    });
                    break;
                case "start-date":
                    // Sort by earliest start date in category
                    sortedCategories = categories.sort((a, b) => {
                        const aEarliestStart = a.tasks
                            .filter(t => t.startDate)
                            .map(t => new Date(t.startDate).getTime())
                            .sort((x, y) => x - y)[0] || Infinity;
                        const bEarliestStart = b.tasks
                            .filter(t => t.startDate)
                            .map(t => new Date(t.startDate).getTime())
                            .sort((x, y) => x - y)[0] || Infinity;
                        return aEarliestStart - bEarliestStart;
                    });
                    break;
                case "priority":
                    // Sort by highest priority in category (high=3, medium=2, low=1, none=0)
                    sortedCategories = categories.sort((a, b) => {
                        const priorityMap: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
                        const aHighestPriority = Math.max(
                            ...a.tasks.map(t => priorityMap[t.priority] || 0),
                            0
                        );
                        const bHighestPriority = Math.max(
                            ...b.tasks.map(t => priorityMap[t.priority] || 0),
                            0
                        );
                        return bHighestPriority - aHighestPriority;
                    });
                    break;
                default:
                    sortedCategories = categories;
            }
            
            workspacesCopy[workspaceIndex].categories = sortedCategories;
            setWorkSpaces(workspacesCopy);
        }
        
        onApply();
    };

    const SortOptionCard = ({ option, label }: { option: SortOption; label: string }) => {
        const isSelected = selectedSort === option;
        return (
            <TouchableOpacity onPress={() => setSelectedSort(option)}>
                <DefaultCard>
                    <View style={styles.sortOptionContent}>
                        <ThemedText type="defaultSemiBold">{label}</ThemedText>
                        {isSelected && (
                            <View
                                style={[
                                    styles.selectedIndicator,
                                    { backgroundColor: ThemedColor.primary },
                                ]}
                            />
                        )}
                    </View>
                </DefaultCard>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                Sort By
            </ThemedText>
            <View style={{ flex: 1, gap: 16 }}>
                <View style={{ gap: 8 }}>
                    <SortOptionCard option="task-count" label="Task Count" />
                    <SortOptionCard option="alphabetical" label="Alphabetical" />
                    <SortOptionCard option="due-date" label="Due Date" />
                    <SortOptionCard option="start-date" label="Start Date" />
                    <SortOptionCard option="priority" label="Priority" />
                </View>
                <PrimaryButton title="Apply Sort" onPress={handleSort} />
            </View>
        </>
    );
};

export default EditWorkspace;

const styles = StyleSheet.create({
    sortOptionContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    selectedIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
});