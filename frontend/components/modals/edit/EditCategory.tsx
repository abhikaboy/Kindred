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
    const { categories } = useTasks();
    const [showEditModal, setShowEditModal] = useState(false);
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal for edit category
    const editCategorySheetRef = useRef<BottomSheetModal>(null);

    // Define snap points for the edit modal
    const snapPoints = useMemo(() => ["30%"], []);

    // Find the current category to get its name
    const currentCategory = categories.find(cat => cat.id === id);
    const currentName = currentCategory?.name || "";

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
            callback: () => {
                console.log("deleting category", id);
                deleteCategory(id);
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
