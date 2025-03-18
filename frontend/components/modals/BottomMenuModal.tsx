import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useEffect } from "react";

import Modal from "react-native-modal";

import ThemedColor from "@/constants/Colors";
import { ThemedText } from "../ThemedText";

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
    options: BottomMenuOption[];
};

//
const options: BottomMenuOption[] = [
    { label: "Edit", icon: "edit", callback: () => {} },
    { label: "Delete", icon: "delete", callback: () => {} },
];

const BottomMenuModal = (props: Props) => {
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
                {props.options.map((option, index) => {
                    return (
                        <TouchableOpacity
                            key={index}
                            style={{ flexDirection: "row", gap: 16 }}
                            onPress={option.callback}>
                            <Feather name={option.icon} size={24} color={ThemedColor.text} />
                            <ThemedText type="default">{option.label}</ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Modal>
    );
};

export default BottomMenuModal;

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
