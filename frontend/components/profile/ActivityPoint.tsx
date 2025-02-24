import { StyleSheet, Text, View } from "react-native";
import React from "react";

type Props = {
    level: number;
};

const LEVELS = { 1: "#453f3f", 2: "#aff0c6", 3: "#5CFF95", 4: "#069A3A" };
const ActivityPoint = ({ level }: Props) => {
    return (
        <View
            style={{
                width: 32,
                height: 32,
                borderRadius: 100,
                backgroundColor: LEVELS[level],
            }}></View>
    );
};

export default ActivityPoint;

const styles = StyleSheet.create({});
