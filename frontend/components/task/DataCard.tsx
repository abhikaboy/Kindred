import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedView } from "../ThemedView";
import { getThemedColor } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

type Props = {
    title: string;
    content?: string;
    children?: React.ReactNode;
};

const DataCard = (props: Props) => {
    let ThemedColor = useThemeColor();
    return (
        <View
            style={{
                backgroundColor: ThemedColor.lightened,
                padding: 16,
                paddingBottom: 24,
                gap: 8,
                borderRadius: 12,
                height: "auto",
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
            }}>
            <ThemedText type="subtitle">{props.title}</ThemedText>
            {props.content && <ThemedText type="default">{props.content}</ThemedText>}
            {props.children}
        </View>
    );
};

export default DataCard;

const styles = StyleSheet.create({});
