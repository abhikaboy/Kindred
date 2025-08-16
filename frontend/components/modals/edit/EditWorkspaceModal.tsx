import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

type Props = {
    hide: () => void;
    currentName: string;
};

const EditWorkspaceModal = ({ hide, currentName }: Props) => {
    let ThemedColor = useThemeColor();
    const [name, setName] = useState(currentName);
    const { doesWorkspaceExist, renameWorkspace } = useTasks();

    const handleEditWorkspace = async () => {
        if (name.length == 0) {
            Alert.alert("Invalid Workspace Name", "Workspace name cannot be empty");
            return;
        }

        if (name === currentName) {
            // No change, just close the modal
            hide();
            return;
        }

        try {
            if (doesWorkspaceExist(name)) {
                Alert.alert("Workspace already exists", "Please enter a different name");
                setName(currentName); // Reset to original name
                return;
            }

            await renameWorkspace(currentName, name);
            
            // Show success toast
            showToastable({
                title: "Workspace renamed!",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: `Workspace renamed from "${currentName}" to "${name}"`,
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
                message: "Failed to rename workspace. Please try again.",
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
                    Edit Workspace
                </ThemedText>
            </View>
            <View style={{ gap: 12 }}>
                <ThemedInput
                    autofocus
                    useBottomSheetInput={true}
                    placeHolder="Enter the Workspace Name"
                    onSubmit={() => {
                        handleEditWorkspace();
                    }}
                    onChangeText={(text) => {
                        setName(text);
                    }}
                    value={name}
                    setValue={setName}
                />
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Update Workspace"
                        onPress={() => {
                            handleEditWorkspace();
                        }}
                    />
                </View>
            </View>
        </View>
    );
};

export default EditWorkspaceModal;

const styles = StyleSheet.create({
    container: {
        gap: 16,
        paddingVertical: 16,
        paddingBottom: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    title: {
        flex: 1,
        textAlign: "center",
        marginRight: 40, // Compensate for the back button
    },
    buttonContainer: {
        marginTop: 8,
    },
});