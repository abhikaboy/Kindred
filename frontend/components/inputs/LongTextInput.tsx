import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    placeholder?: string;
    value: string;
    setValue: (text: string) => void;
    onBlur?: () => void;
    minHeight?: number;
    fontSize?: number;
};

const LongTextInput = ({ 
    placeholder, 
    value, 
    setValue, 
    onBlur, 
    minHeight = 100,
    fontSize = 16 
}: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View>
            <TextInput
                placeholder={placeholder}
                placeholderTextColor={ThemedColor.ghost}
                multiline={true}
                numberOfLines={6}
                value={value}
                onChangeText={setValue}
                onBlur={onBlur}
                style={{
                    backgroundColor: "transparent",
                    color: ThemedColor.text,
                    fontSize: fontSize,
                    fontFamily: "Outfit",
                    fontWeight: "400",
                    lineHeight: fontSize * 1.5, 
                    padding: 0,
                    margin: 0,
                    borderWidth: 0,
                    minHeight: minHeight,
                    textAlignVertical: "top",
                }}
            />
        </View>
    );
};

export default LongTextInput;