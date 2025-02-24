import { StyleSheet, Text, View, TextInput } from "react-native";
import React from "react";
import { Colors } from "@/constants/Colors";

type Props = {
    onSubmit?: () => void;
    onChangeText?: (text: string) => void;
};

const ThemedInput = (props: Props) => {
    const [value, setValue] = React.useState("");
    return (
        <View>
            <TextInput
                placeholder="Search"
                onSubmitEditing={props?.onSubmit}
                onChangeText={(text) => {
                    setValue(text);
                    props.onChangeText?.(text);
                }}
                value={value}
                style={{
                    backgroundColor: Colors.dark.lightened,
                    color: Colors.dark.text,
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
};

export default ThemedInput;

const styles = StyleSheet.create({});
