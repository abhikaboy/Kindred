import { StyleProp, StyleSheet, Text, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {};

const ModalHead = (props: StyleProp<any>) => {
    let ThemedColor = useThemeColor();

    return (
        <View
            style={{
                backgroundColor: ThemedColor.modalTop,
                width: 48,
                height: 2,
                borderRadius: 1,
                justifyContent: "center",
                alignSelf: "center",
                marginBottom: 12,
            }}
        />
    );
};

export default ModalHead;
