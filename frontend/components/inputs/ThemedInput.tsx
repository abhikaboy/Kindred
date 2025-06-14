import { StyleSheet, Text, View, TextInput } from "react-native";
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
                    backgroundColor: ThemedColor.lightened,
                    color: ThemedColor.text,
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    fontFamily: "OutfitLight",
                    paddingRight: 24,
                    paddingLeft: 24,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                }}
            />
        </View>
    );
});

export default ThemedInput;

const styles = StyleSheet.create({});
