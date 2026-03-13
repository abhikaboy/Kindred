import { StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

type Props = {
    level: number;
    isFuture?: boolean;
    isToday?: boolean;
    onPress?: () => void;
    size?: number;
};

const ActivityPoint = ({ level, isFuture = false, isToday = false, onPress, size }: Props) => {
    const ThemedColor = useThemeColor();
    const LEVELS: Record<number, string> = {
        0: ThemedColor.lightened,
        1: "#A2FFA8",
        2: "#8ff086",
        3: "#2CFF25",
        4: "#069A3A",
    };
    const [display, setDisplay] = useState(false);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            setDisplay(!display);
        }
    };

    const s = size ?? 34;

    return (
        <TouchableOpacity onPress={handlePress}>
            <View
                style={{
                    width: s,
                    height: s,
                    borderRadius: 6,
                    backgroundColor: LEVELS[level] || LEVELS[0],
                    justifyContent: "center",
                    borderWidth: isToday ? 2 : (level === 0 ? 1 : 0),
                    borderColor: isToday ? ThemedColor.primary : ThemedColor.text + "05",
                    opacity: isFuture ? 0.25 : 1,
                }}>
                {display && level > 0 && (
                    <ThemedText
                        type="lightBody"
                        style={{
                            color: ThemedColor.background,
                            textAlign: "center",
                            fontSize: 11,
                        }}>
                        {level}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default ActivityPoint;
