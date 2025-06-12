import { StyleSheet, Text, View, TextInput, StyleProp, TextStyle } from "react-native";
import React, { forwardRef } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
    placeHolder?: string;
    width?: number;
    ref?: React.RefObject<TextInput>;
    autofocus?: boolean;
    value: string;
    setValue: (text: string) => void;
    onBlur?: () => void;
    ghost?: boolean;
    textStyle?: StyleProp<TextStyle>;
};

const ThemedInput = forwardRef(function ThemedInput(
    props: Props,
    ref: React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
) {
    let ThemedColor = useThemeColor();

    return (
        <View>
            <TextInput
                ref={ref}
                autoFocus={props?.autofocus}
                placeholder={props?.placeHolder}
                onSubmitEditing={props?.onSubmit}
                onChangeText={(text) => {
                    props.setValue(text);
                    props.onChangeText?.(text);
                }}
                onBlur={props?.onBlur}
                value={props.value}
                style={{
                    backgroundColor: props.ghost ? "transparent" : ThemedColor.lightened,
                    color: ThemedColor.text,
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    fontFamily: "OutfitLight",
                    paddingRight: props.ghost ? 0 : 24,
                    paddingLeft: props.ghost ? 0 : 24,
                    borderWidth: props.ghost ? 0 : 1,
                    borderColor: props.ghost ? ThemedColor.tertiary : ThemedColor.lightened,
                    ...(props.textStyle as object),
                }}
            />
        </View>
    );
});

export default ThemedInput;

const styles = StyleSheet.create({});
