import ThemedColor from "@/constants/Colors";
import React from "react";
import { View } from "react-native";

type Props = {
    selected: boolean;
};

export default function SelectedIndicator({ selected }: Props) {
    if (!selected) return null;
    return (
        <View style={{ width: 8, height: 8, marginLeft: 8, borderRadius: 20, backgroundColor: ThemedColor.primary }} />
    );
}
