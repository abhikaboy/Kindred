import { StyleSheet, Text, View, TextInput } from "react-native";
import React, { forwardRef } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
    placeHolder?: string;
    width?: number;
    ref?: React.RefObject<TextInput>;
    autofocus?: boolean;
    value: string;
    setValue: (text: string) => void;
};

const ThemedInput = forwardRef(function ThemedInput(props: Props, ref: React.Ref<TextInput>) {
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
                value={props.value}
                style={{
                    backgroundColor: ThemedColor.lightened,
                    color: ThemedColor.text,
                    borderRadius: 20,
                    padding: 16,
                    fontSize: 16,
                    fontFamily: "Outfit",
                    paddingRight: 24,
                    paddingLeft: 24,
                }}
            />
        </View>
    );
});

export default ThemedInput;

const styles = StyleSheet.create({});
