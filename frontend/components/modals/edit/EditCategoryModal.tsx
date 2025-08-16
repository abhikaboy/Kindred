import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

type Props = {
    hide: () => void;
    categoryId: string;
    currentName: string;
};

const EditCategoryModal = ({ hide, categoryId, currentName }: Props) => {
    let ThemedColor = useThemeColor();
    const [name, setName] = useState(currentName);
    const { renameCategory } = useTasks();

    const handleEditCategory = async () => {
        if (name.length == 0) {
            Alert.alert("Invalid Category Name", "Category name cannot be empty");
            return;
        }

        if (name === currentName) {
            // No change, just close the modal
            hide();
            return;
        }

        try {
            await renameCategory(categoryId, name);
            
            // Show success toast
            showToastable({
                title: "Category renamed!",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: `Category renamed from "${currentName}" to "${name}"`,
                renderContent: (props) => <DefaultToast {...props} />,
            });
            
            hide();
        } catch (err) {
            console.log(err);
            
            // Show error toast
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to rename category. Please try again.",
                renderContent: (props) => <DefaultToast {...props} />,
            });
            
            setName(currentName); // Reset to original name on error
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={hide}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.title}>
                    Edit Category
                </ThemedText>
            </View>
            <View style={{ gap: 12 }}>
                <ThemedInput
                    autofocus
                    useBottomSheetInput={true}
                    placeHolder="Enter the Category Name"
                    onSubmit={() => {
                        handleEditCategory();
                    }}
                    onChangeText={(text) => {
                        setName(text);
                    }}
                    value={name}
                    setValue={setName}
                />
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Update Category"
                        onPress={() => {
                            handleEditCategory();
                        }}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    title: {
        flex: 1,
        textAlign: "center",
        marginRight: 36, // Offset the arrow width for true centering
    },
    buttonContainer: {
        marginTop: 8,
    },
});

export default EditCategoryModal;
