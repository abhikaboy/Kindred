import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

type Props = {
    level: number;
};

const ActivityPoint = ({ level }: Props) => {
    let ThemedColor = useThemeColor();
    const LEVELS = { 
        0: ThemedColor.lightened, // No activity - use lightened background color
        1: ThemedColor.tertiary, 
        2: "#aff0c6", 
        3: "#5CFF95", 
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
                    borderWidth: level === 0 ? 1 : 0, // Add border for level 0 to make it visible
                    borderColor: ThemedColor.text + "05", // Subtle border color
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
