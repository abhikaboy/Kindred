import { Alert, StyleSheet, Text, Touchable, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import NextButton from "@/components/inputs/NextButton";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { createWorkspace } from "../../../api/workspace";

type Props = {
    hide: () => void;
};

const NewWorkspace = ({ hide }: Props) => {
    let ThemedColor = useThemeColor();
    const [name, setName] = useState("");
    const { selected, addWorkspace, doesWorkspaceExist, setSelected } = useTasks();

    const handleCreateWorkspace = async () => {
        if (name.length == 0) {
            Alert.alert("Invalid Workspace Name", "Workspace name cannot be empty");
            return;
        }
        try {
            if (doesWorkspaceExist(name)) {
                Alert.alert("Workspace already exists", "Please enter a different name");
                setName("");
                throw new Error("Workspace already exists");
            }
            const response = await createWorkspace(name);
            addWorkspace(name, response);
            setSelected(name);
            hide();
        } catch (err) {
            console.log(err);
            Alert.alert("Error", "Failed to create workspace");
            setName("");
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={hide}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.title}>
                    New Workspace
                </ThemedText>
            </View>
            <View style={{ gap: 12 }}>
                <ThemedInput
                    autofocus
                    placeHolder="Enter the Workspace Name"
                    onSubmit={() => {
                        handleCreateWorkspace();
                    }}
                    onChangeText={(text) => {
                        setName(text);
                    }}
                    value={name}
                    setValue={setName}
                />
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Create Workspace"
                        onPress={() => {
                            handleCreateWorkspace();
                        }}
                    />
                </View>
            </View>
        </View>
    );
};

export default NewWorkspace;

const styles = StyleSheet.create({
    container: {
        gap: 24,
        display: "flex",
        flexDirection: "column",
        marginTop: 16,
    },
    header: {
        display: "flex",
        flexDirection: "row",
        gap: 16,
    },
    title: {
        textAlign: "center",
    },
    buttonContainer: {
        width: "100%",
        alignItems: "center",
    },
});
