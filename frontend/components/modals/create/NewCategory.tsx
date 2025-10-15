import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { useBlueprints } from "@/contexts/blueprintContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { ObjectId } from "bson";
import type { components } from "@/api/generated/types";
import Feather from "@expo/vector-icons/Feather";

type Props = {
    goToStandard: () => void;
    isBlueprint?: boolean; // Flag to indicate if this modal is being used for blueprint creation
};

const NewCategory = ({ goToStandard, isBlueprint = false }: Props) => {
    const [name, setName] = useState("");
    const { selected, addToWorkspace, setCreateCategory } = useTasks();
    const { request } = useRequest();
    const { addBlueprintCategory } = useBlueprints();
    const { isBlueprint: isBlueprintMode } = useTaskCreation();
    let ThemedColor = useThemeColor();

    const createCategory = async () => {
        try {
            if (isBlueprint || isBlueprintMode) {
                // For blueprint mode, create category locally with proper CategoryDocument structure
                const newCategory: components["schemas"]["CategoryDocument"] = {
                    id: new ObjectId().toString(), // Temporary ID for local use
                    name: name,
                    workspaceName: selected || "Personal",
                    lastEdited: new Date().toISOString(),
                    tasks: [], // Initialize with empty tasks array
                    user: "", // Will be set by backend when blueprint is created
                };
                
                addBlueprintCategory(newCategory);
                setCreateCategory({ label: name, id: newCategory.id, special: false });
                return true;
            } else {
                // Normal mode - create category via API
                const response = await request("POST", `/user/categories`, {
                    name: name,
                    workspaceName: selected,
                });

                addToWorkspace(selected, response);
                setCreateCategory({ label: name, id: response.id, special: false });
                return true;
            }
        } catch (error) {
            console.log(error);
            return false;
        }
    };

    return (
        <View style={{ gap: 16, display: "flex", flexDirection: "column" }}>
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
                onSubmit={async () => {
                    if (name.length > 0) {
                        const success = await createCategory();
                        if (success) {
                            // set the selected category to the new category
                            goToStandard();
                        }
                    }
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
                    onPress={async () => {
                        const success = await createCategory();
                        if (success) {
                            goToStandard();
                        }
                    }}
                />
            </View>
        </View>
    );
};

export default NewCategory;

const styles = StyleSheet.create({});
