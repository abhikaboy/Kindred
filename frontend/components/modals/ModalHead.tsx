import { StyleProp, StyleSheet, Text, View } from "react-native";
import React from "react";
import ThemedColor from "@/constants/Colors";

type Props = {};

const ModalHead = (props: StyleProp<any>) => {
    return (
        <View
            style={{
                backgroundColor: ThemedColor.modalTop,
                width: 48,
                height: 2,
                borderRadius: 1,
                justifyContent: "center",
                alignSelf: "center",
            }}
        />
    );
};

export default ModalHead;
