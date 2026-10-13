import React from "react";
import { View, Image, StyleSheet } from "react-native";

// Must match the expo-splash-screen config in app.json for a seamless handoff
const SPLASH_BACKGROUND = "#13121F";

// Static stand-in for the native splash while auth/route resolution finishes.
// No animation — it looks identical to the native splash until content renders.
export default function SplashHold() {
    return (
        <View style={[styles.container, { backgroundColor: SPLASH_BACKGROUND }]}>
            <Image source={require("@/assets/splash-icon-dark.png")} style={styles.logo} resizeMode="contain" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    logo: {
        width: 120,
        height: 120,
    },
});
