import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";

type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
    placeHolder?: string;
    width?: number;
    value?: string;
    autoFocus?: boolean;
};

const CommentInput = (props: Props) => {
    const [internalValue, setInternalValue] = React.useState("");
    const ThemedColor = useThemeColor();
    const { width: windowWidth } = useWindowDimensions();

    // Use controlled value if provided, otherwise use internal state
    const value = props.value !== undefined ? props.value : internalValue;

    const handleChangeText = (text: string) => {
        if (props.value !== undefined) {
            // Controlled component
            props.onChangeText?.(text);
        } else {
            // Uncontrolled component
            setInternalValue(text);
            props.onChangeText?.(text);
        }
    };

    return (
        <View style={styles.container}>
            <BottomSheetTextInput
                autoFocus={props.autoFocus}
                placeholder={props.placeHolder || "Leave a comment"}
                onSubmitEditing={props?.onSubmit}
                onChangeText={handleChangeText}
                value={value}
                multiline={false}
                returnKeyType="send"
                blurOnSubmit={true}
                style={{
                    backgroundColor: ThemedColor.background,
                    color: ThemedColor.text,
                    borderRadius: 100,
                    borderWidth: 1.3,
                    borderColor: ThemedColor.input,
                    paddingVertical: 12,
                    fontSize: 16,
                    fontFamily: "Outfit",
                    paddingHorizontal: 20,
                    flex: 1,
                    minWidth: Math.min(windowWidth * 0.7, 280),
                }}
                placeholderTextColor={ThemedColor.caption}
            />
        </View>
    );
};

export default CommentInput;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
