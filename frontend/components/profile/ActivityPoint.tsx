import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

type Props = {
    level: number;
    isFuture?: boolean;
    isToday?: boolean;
};

const ActivityPoint = ({ level, isFuture = false, isToday = false }: Props) => {
    let ThemedColor = useThemeColor();
    const LEVELS = { 
        0: ThemedColor.lightened, // No activity - use lightened background color
        1: "#A2FFA8", 
        2: "#8ff086", 
        3: "#2CFF25", 
        4: "#069A3A" 
    };
    const [display, setDisplay] = useState(false);
    
    return (
        <TouchableOpacity onPress={() => setDisplay(!display)}>
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 5,
                    backgroundColor: LEVELS[level] || LEVELS[0], // Default to level 0 if level is not found
                    justifyContent: "center",
                    borderWidth: isToday ? 2 : (level === 0 ? 1 : 0), // Primary border for today, subtle border for level 0
                    borderColor: isToday ? ThemedColor.primary : ThemedColor.text + "05", // Primary color for today, subtle for level 0
                    opacity: isFuture ? 0.25 : 1, // 25% opacity for future days
                }}>
                {display && level > 0 && (
                    <ThemedText
                        type="lightBody"
                        style={{
                            color: ThemedColor.background,
                            textAlign: "center",
                        }}>
                        {level}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default ActivityPoint;

const styles = StyleSheet.create({});
