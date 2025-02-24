import { Dimensions, StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import LogInButton from "@/components/auth/LogInButton";
import SignUpButton from "@/components/auth/SignUpButton";

type Props = {};

const login = (props: Props) => {
    return (
        <ThemedView style={{ paddingTop: Dimensions.get("screen").height * 0.12, paddingHorizontal: 24 }}>
            <View>
                <ThemedText type="hero">Login</ThemedText>
                <View style={{ flex: 0, flexDirection: "column" }}>
                    <LogInButton />
                    <SignUpButton />
                </View>
            </View>
        </ThemedView>
    );
};

export default login;

const styles = StyleSheet.create({});
