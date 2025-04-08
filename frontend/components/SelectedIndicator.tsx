import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import { View } from "react-native";

type Props = {
    selected: boolean;
};

export default function SelectedIndicator({ selected }: Props) {
    let ThemedColor = useThemeColor();
    if (!selected) return null;
    return (
        <View style={{ width: 8, height: 8, marginLeft: 8, borderRadius: 20, backgroundColor: ThemedColor.primary }} />
    );
}
