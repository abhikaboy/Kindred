import { StyleSheet, Text, View } from "react-native";
import React, { useState, useRef, useCallback, useMemo } from "react";
import BottomMenuModal from "../BottomMenuModal";
import EditCategoryModal from "./EditCategoryModal";
import { deleteCategory } from "@/api/category";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string;
};

const EditCategory = (props: Props) => {
    const { editing, setEditing, id } = props;
    const { categories, workspaces, removeFromWorkspace } = useTasks();
    const [showEditModal, setShowEditModal] = useState(false);
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal for edit category
    const editCategorySheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the edit modal
    const snapPoints = useMemo(() => ["50%"], []);

    // Find the current category to get its name
    const currentCategory = categories.find(cat => cat.id === id);
    const currentName = currentCategory?.name || "";
    const currentTags = currentCategory?.tags ?? [];

    // Helper function to find which workspace contains this category
    const findWorkspaceNameForCategory = (categoryId: string): string | null => {
        for (const workspace of workspaces) {
            if (workspace.categories.some(cat => cat.id === categoryId)) {
                return workspace.name;
            }
        }
        return null;
    };

    const handleEditClick = () => {
        setShowEditModal(true);
        setEditing(false); // Close the edit menu
        editCategorySheetRef.current?.present();
    };

    const handleEditSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && showEditModal) {
                setShowEditModal(false);
            }
        },
        [showEditModal]
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
        {
            label: "Delete",
            icon: "delete",
            callback: async () => {
                // Find which workspace contains this category
                const workspaceName = findWorkspaceNameForCategory(id);

                try {
                    // First update local state immediately
                    if (workspaceName) {
                        removeFromWorkspace(workspaceName, id);
                    }

                    // Then call API to delete from backend
                    await deleteCategory(id);
                } catch (error) {
                    console.error("Error deleting category:", error);
                    // If API call fails, we should restore the local state
                    // For now, we'll refresh the data to ensure consistency
                    // TODO: Add proper error handling and state restoration
                }

                setEditing(false);
            },
        },
    ];

    return (
        <>
            <BottomMenuModal id={{ id: "", category: id }} visible={editing} setVisible={setEditing} options={options} />

            {/* Edit Category Bottom Sheet Modal */}
            <BottomSheetModal
                ref={editCategorySheetRef}
                index={0}
                snapPoints={snapPoints}
                onChange={handleEditSheetChanges}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView
                    style={{
                        paddingHorizontal: 20,
                    }}>
                    <EditCategoryModal
                        categoryId={id}
                        currentName={currentName}
                        currentTags={currentTags}
                        hide={() => {
                            setShowEditModal(false);
                            editCategorySheetRef.current?.dismiss();
                        }}
                    />
                </BottomSheetView>
            </BottomSheetModal>
        </>
    );
};

export default EditCategory;

const styles = StyleSheet.create({});
