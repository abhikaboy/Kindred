import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useEffect } from "react";

import Modal from "react-native-modal";

import ThemedColor from "@/constants/Colors";
import ThemedInput from "../inputs/ThemedInput";
import Dropdown from "../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { ThemedText } from "../ThemedText";
import { Task } from "react-native";

import Feather from "@expo/vector-icons/Feather";
import ModalHead from "./ModalHead";

type ID = {
    id: string;
    category: string;
};
type Props = {
    id: ID;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
};

const EditModal = (props: Props) => {
    const { request } = useRequest();
    const { categories, removeFromCategory } = useTasks();

    const editPost = async () => {
        if (categories.length === 0) return;
    };
    const deletePost = async () => {
        if (categories.length === 0) return;
        const { id, category } = props.id;
        const response = await request("DELETE", `/user/tasks/${category}/${id}`);
        removeFromCategory(category, id);
        console.log(response);
    };

    return (
        <Modal
            onBackdropPress={() => props.setVisible(false)}
            onBackButtonPress={() => props.setVisible(false)}
            isVisible={props.visible}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            avoidKeyboard>
            <View style={styles.container}>
                <ModalHead />
                <TouchableOpacity style={{ flexDirection: "row", gap: 16 }}>
                    <Feather name="edit" size={24} color="white" />
                    <ThemedText type="default">Edit Post</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: "row", gap: 16 }} onPress={deletePost}>
                    <Feather name="x" size={24} color="white" />
                    <ThemedText type="default">Delete Post</ThemedText>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

export default EditModal;

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
