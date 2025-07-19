import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    children: React.ReactNode;
};

const BasicCard = ({ children }: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <View
            style={{
                backgroundColor: ThemedColor.lightened,
                borderRadius: 12,
                padding: 16,
                justifyContent: "space-between",
                boxShadow: ThemedColor.shadowSmall,
            }}>
            {children}
        </View>
    );
};

export default BasicCard;

const styles = StyleSheet.create({});
