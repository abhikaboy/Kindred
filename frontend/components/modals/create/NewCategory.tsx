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
    goToStandard: () => void;
};

const NewCategory = ({ goToStandard }: Props) => {
    const [name, setName] = useState("");
    const { selected, addToWorkspace } = useTasks();
    const { request } = useRequest();
    let ThemedColor = useThemeColor();

    const createCategory = async () => {
        const response = await request("POST", `/user/categories`, {
            name: name,
            workspaceName: selected,
        });

        addToWorkspace(selected, response);
        console.log(response);
    };

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    New Category
                </ThemedText>
            </View>
            <ThemedInput
                autofocus
                placeHolder="Enter the Category Name"
                onSubmit={() => {
                    goToStandard();
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
                    title="Create Category"
                    onPress={() => {
                        createCategory();
                        goToStandard();
                    }}
                />
            </View>
        </View>
    );
};

export default NewCategory;

const styles = StyleSheet.create({});
