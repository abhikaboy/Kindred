import { Dimensions, StyleSheet, Text, TextInput, View } from "react-native";
import React, { useEffect, useState } from "react";

import Modal from "react-native-modal";

import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "../inputs/ThemedInput";
import Dropdown from "../inputs/Dropdown";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import ModalHead from "./ModalHead";
import Standard from "./create/Standard";
import ConditionalView from "../ui/ConditionalView";
import NewCategory from "./create/NewCategory";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    focused?: string;
    setFocused?: (focused: string) => void;
};

export enum Screen {
    STANDARD,
    NEW_CATEGORY,
    EDIT,
    DEADLINE,
    RECURRING,
    STARTDATE,
    STARTTIME,
}

const CreateModal = (props: Props) => {
    const [screen, setScreen] = React.useState(Screen.STANDARD);
    let ThemedColor = useThemeColor();

    return (
        <Modal
            onBackdropPress={() => props.setVisible(false)}
            onBackButtonPress={() => props.setVisible(false)}
            isVisible={props.visible}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            avoidKeyboard>
            <View style={styles.container}>
                <ModalHead style={{ marginBottom: 16 }} />
                <ConditionalView condition={screen === Screen.STANDARD}>
                    <Standard hide={() => props.setVisible(false)} goTo={setScreen} />
                </ConditionalView>
                <ConditionalView condition={screen === Screen.NEW_CATEGORY}>
                    <NewCategory goToStandard={() => setScreen(Screen.STANDARD)} />
                </ConditionalView>
            </View>
        </Modal>
    );
};

export default CreateModal;

let ThemedColor = useThemeColor();

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: Dimensions.get("screen").width,
        backgroundColor: ThemedColor.background,
        padding: 24,
        gap: 8,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        left: -24,
        position: "absolute",
    },
});
