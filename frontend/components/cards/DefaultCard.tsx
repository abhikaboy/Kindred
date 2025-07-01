import { View, ViewProps } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    children: React.ReactNode;
};

const DefaultCard = ({ children }: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <View
            style={{
                backgroundColor: ThemedColor.lightened,
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.tertiary,
            }}>
            {children}
        </View>
    );
};

export default DefaultCard;
