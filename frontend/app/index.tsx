import React from "react";
import { View, StyleSheet } from "react-native";
import LogInButton from "@/components/auth/LogInButton";
import SignUpButton from "@/components/auth/SignUpButton";


export default function LoginScreen() {
    return (
        <View style={styles.container}>
            <SignUpButton />
            <LogInButton />
        </View>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 20,
    },
});
