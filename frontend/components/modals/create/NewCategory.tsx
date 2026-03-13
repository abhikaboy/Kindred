import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { useBlueprints } from "@/contexts/blueprintContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { ObjectId } from "bson";
import type { components } from "@/api/generated/types";

type Props = {
    goToStandard: () => void;
    isBlueprint?: boolean;
};

const NewCategory = ({ goToStandard, isBlueprint = false }: Props) => {
    const [name, setName] = useState("");
    const { selected, addToWorkspace, setCreateCategory } = useTasks();
    const { request } = useRequest();
    const { addBlueprintCategory } = useBlueprints();
    const { isBlueprint: isBlueprintMode } = useTaskCreation();
    const ThemedColor = useThemeColor();

    const createCategory = async () => {
        try {
            if (isBlueprint || isBlueprintMode) {
                const newCategory: components["schemas"]["CategoryDocument"] = {
                    id: new ObjectId().toString(),
                    name: name,
                    workspaceName: selected || "Personal",
                    lastEdited: new Date().toISOString(),
                    tasks: [],
                    user: "",
                };
                
                addBlueprintCategory(newCategory);
                setCreateCategory({ label: name, id: newCategory.id, special: false });
                return true;
            } else {
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

    const handleCreate = async () => {
        if (name.length === 0) return;
        const success = await createCategory();
        if (success) goToStandard();
    };

    return (
        <View style={styles.container}>
            <ThemedInput
                autofocus
                useBottomSheetInput
                placeHolder="New Category Name"
                onSubmit={handleCreate}
                onChangeText={setName}
                value={name}
                setValue={setName}
                ghost
                textStyle={{
                    fontSize: 22,
                    fontFamily: "Outfit",
                    fontWeight: "500",
                    letterSpacing: -0.2,
                }}
            />
            <View style={styles.buttonRow}>
                <PrimaryButton
                    title="Back"
                    onPress={goToStandard}
                    outline
                    style={styles.halfButton}
                    textStyle={{ fontSize: 14 }}
                />
                <PrimaryButton
                    title="Create"
                    onPress={handleCreate}
                    disabled={name.length === 0}
                    style={styles.halfButton}
                    textStyle={{ fontSize: 14 }}
                />
            </View>
        </View>
    );
};

export default NewCategory;

const styles = StyleSheet.create({
    container: {
        gap: 16,
        flexDirection: "column",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 10,
    },
    halfButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
    },
});
