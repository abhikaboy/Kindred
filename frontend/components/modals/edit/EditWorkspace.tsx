import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import BottomMenuModal from "../BottomMenuModal";
import DeleteWorkspaceConfirmationModal from "../DeleteWorkspaceConfirmationModal";
import { useTasks } from "@/contexts/tasksContext";
import { deleteWorkspace } from "@/api/category";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

type Props = {
    editing: boolean;
    setEditing: (editing: boolean) => void;
    id: string; // This is the workspace name
};

const EditWorkspace = (props: Props) => {
    const { editing, setEditing, id } = props;
    const { removeWorkspace, getWorkspace, restoreWorkspace } = useTasks();
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

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

    const options = [
        { label: "Edit", icon: "edit", callback: () => {} },
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
