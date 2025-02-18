import { StyleSheet, Text, View, Switch } from "react-native";
import React from "react";
import { Colors } from "@/constants/Colors";

type Props = {};

const ThemedSwitch = (props: Props) => {
    const [value, setValue] = React.useState(false);
    return (
        <View>
            <Switch
                value={value}
                onValueChange={() => {
                    setValue(!value);
                }}
                trackColor={{ false: "#767577", true: Colors.dark.primary }}
                thumbColor="white"
                style={{
                    width: 50,
                    height: 28,
                    borderRadius: 100,
                }}
            />
        </View>
    );
};

export default ThemedSwitch;

const styles = StyleSheet.create({});
