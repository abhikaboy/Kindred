import { StyleSheet, Text, View } from "react-native";
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

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string; // This is the workspace name
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id } = props;
    const { removeWorkspace, getWorkspace, restoreWorkspace } = useTasks();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal for edit workspace
    const editWorkspaceSheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the edit modal
    const snapPoints = useMemo(() => ["30%"], []);

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
        { label: "Delete", icon: "delete", callback: handleDeleteClick },
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
                    <EditWorkspaceModal
                        currentName={id}
                        hide={() => {
                            setShowEditModal(false);
                            editWorkspaceSheetRef.current?.dismiss();
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

export default EditWorkspace;

const styles = StyleSheet.create({});