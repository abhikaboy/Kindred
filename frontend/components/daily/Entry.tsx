import { TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    day: string;
    date: string;
    outline: boolean;
    onPress: () => void;
};

const Entry = (props: Props) => {
    const { day, date, outline, onPress } = props;
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            style={{
                flexDirection: "column",
                gap: 4,
                alignItems: "center",
                borderWidth: outline ? 1 : 0,
                borderRadius: 4,
                padding: 8,
                borderColor: outline ? ThemedColor.text : "transparent",
            }}
            onPress={onPress}>
            <View>
                <ThemedText type="default">{day}</ThemedText>
            </View>
            <View>
                <ThemedText type="default">{date}</ThemedText>
            </View>
        </TouchableOpacity>
    );
};

export default Entry;
