import { StyleSheet, Text, Touchable, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import NextButton from "@/components/inputs/NextButton";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    hide: () => void;
};

const NewWorkspace = ({ hide }: Props) => {
    let ThemedColor = useThemeColor();
    const [name, setName] = useState("");
    const { selected, addWorkspace } = useTasks();
    const { request } = useRequest();

    const createWorkspace = async () => {
        const response = await request("POST", `/user/categories`, {
            name: "Miscellaneous",
            workspaceName: name,
        });
        addWorkspace(name, response);
        console.log(response);
    };

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column", backgroundColor: ThemedColor.background }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={hide}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    New Workspace
                </ThemedText>
            </View>
            <ThemedInput
                autofocus
                placeHolder="Enter the Workspace Name"
                onSubmit={() => {
                    hide();
                }}
                onChangeText={(text) => {
                    setName(text);
                }}
                value={name}
                setValue={setName}
            />
            <View
                style={{
                    gap: 16,
                    width: "100%",
                    alignItems: "center",
                }}>
                <PrimaryButton
                    title="Create Workspace"
                    onPress={() => {
                        createWorkspace()
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

const styles = StyleSheet.create({});
