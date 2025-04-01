import { StyleSheet, Text, View, TextInput, Dimensions } from "react-native";
import React from "react";
import ThemedColor from "@/constants/Colors";

type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
    placeHolder?: string;
    width?: number;
};

const CommentInput = (props: Props) => {
    const [value, setValue] = React.useState("");
    return (
        <View>
            <TextInput
                placeholder="Leave a comment"
                onSubmitEditing={props?.onSubmit}
                onChangeText={(text) => {
                    setValue(text);
                    props.onChangeText?.(text);
                }}
                value={value}
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
                    width: Dimensions.get("screen").width * 0.7,
                }}
            />
        </View>
    );
};

export default CommentInput;

const styles = StyleSheet.create({});
