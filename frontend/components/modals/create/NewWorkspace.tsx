import { StyleSheet, Text, Touchable, TouchableOpacity, View } from "react-native";
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
    const { selected, addWorkspace } = useTasks();

    const handleCreateWorkspace = async () => {
        const response = await createWorkspace(name);
        addWorkspace(name, response);
    };

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={hide}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                    New Workspace
                </ThemedText>
            </View>
            <ThemedInput
                autofocus
                placeHolder="Enter the Workspace Name"
                onSubmit={() => {
                    handleCreateWorkspace();
                    hide();
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
                        handleCreateWorkspace()
                            .then(() => {
                                hide();
                            })
                            .catch((err) => {
                                console.log(err);
                            });
                    }}
                />
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
        gap: 16,
        width: "100%",
        alignItems: "center",
    },
});
