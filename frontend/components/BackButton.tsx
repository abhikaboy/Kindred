import { StyleSheet, Text, View } from "react-native";
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function BackButton() {
    return (
        <View
            style={{
                marginLeft: 4,
            }}>
            <Ionicons name="chevron-back" size={28} color="white" />
        </View>
    );
}

const styles = StyleSheet.create({});
