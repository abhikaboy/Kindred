import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useEffect } from "react";

import Modal from "react-native-modal";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useCreateModal } from "@/contexts/createModalContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { Screen } from "../CreateModal";
import { Task } from "@/api/types";
import BottomMenuModal from "../BottomMenuModal";
import { removeFromCategoryAPI } from "@/api/task";
type ID = {
    id: string;
    category: string;
};
type Props = {
    id: ID;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    onStartWorking?: () => void;
    task?: Task;
};

const EditPost = (props: Props) => {
    let ThemedColor = useThemeColor();

    const { categories, removeFromCategory } = useTasks();
    const { openModal } = useCreateModal();
    const { loadTaskData } = useTaskCreation();

    const editPost = async () => {
        if (!props.task) return;
        loadTaskData(props.task);
        openModal({
            edit: true,
            categoryId: props.id.category,
            screen: Screen.STANDARD,
        });
    };
    const deletePost = async () => {
        if (categories.length === 0) return;
        const { id, category } = props.id;
        await removeFromCategoryAPI(category, id);
        removeFromCategory(category, id);
    };

    const options = [
        ...(props.onStartWorking
            ? [{ label: "Start Working", icon: "play", callback: props.onStartWorking }]
            : []),
        { label: "Edit", icon: "edit", callback: editPost },
        { label: "Delete", icon: "delete", callback: deletePost },
    ];
    return <BottomMenuModal id={props.id} visible={props.visible} setVisible={props.setVisible} options={options} />;
};

export default EditPost;
let ThemedColor = useThemeColor();

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: Dimensions.get("screen").width,
        backgroundColor: ThemedColor.background,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        paddingBottom: Dimensions.get("screen").height * 0.1,
        paddingTop: 32,
        paddingLeft: 24,
        left: -24,
        gap: 24,
        position: "absolute",
    },
});
