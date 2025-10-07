import { View, Text, Dimensions, Image, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import React, { useState } from "react";
import { Colors } from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";

const { width, height } = Dimensions.get("screen");

const LoginPhone = () => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { login } = useAuth();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async () => {
        if (!phoneNumber || !password) {
            setError("Please enter both phone number and password");
            return;
        }
        
        setLoading(true);
        setError("");
        
        try {
            // For now, using the existing login which expects email
            // TODO: Update to use phone login endpoint when available
            await login(phoneNumber);
            router.push("/(logged-in)/(tabs)/(task)");
        } catch (err) {
            console.error("Login failed:", err);
            setError("Login failed. Please check your credentials and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    {/* Background Graphics */}
                    <OnboardingBackground variant="default" />

                    {/* Main Content */}
                    <View style={styles.contentContainer}>
                        {/* Title */}
                        <ThemedText
                            type="titleFraunces"
                            style={styles.title}>
                            Login
                        </ThemedText>

                        {/* Input Fields */}
                        <View style={styles.inputContainer}>
                            <PhoneInput
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="(555) 123-4567"
                            />
                            <ThemedInput
                                value={password}
                                setValue={setPassword}
                                placeHolder="Password"
                                textStyle={styles.inputText}
                                secureTextEntry={true}
                            />
                        </View>

                        {/* Continue Button */}
                        <PrimaryButton
                            title="Continue"
                            onPress={handleLogin}
                            disabled={loading || !phoneNumber || !password}
                            style={styles.continueButton}
                        />

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>
                                    {error}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Bottom Image */}
                    <Image
                        source={require("../assets/images/sit-tasks.png")}
                        style={styles.bottomImage}
                        resizeMode="contain"
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        minHeight: height,
        position: "relative",
    },
    contentContainer: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: height * 0.18,
        gap: 36,
        zIndex: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: "600",
        color: Colors.light.text,
        letterSpacing: -1,
        lineHeight: 38,
    },
    inputContainer: {
        gap: 16,
        width: "100%",
    },
    inputText: {
        fontSize: 16,
        fontFamily: "OutfitLight",
    },
    continueButton: {
        width: "100%",
        borderRadius: 8,
        paddingVertical: 12,
    },
    errorContainer: {
        width: "100%",
    },
    errorText: {
        color: Colors.light.error,
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
    bottomImage: {
        position: "absolute",
        bottom: 20,
        right: 0,
        width: width * 0.7,
        height: height * 0.35,
        zIndex: 5,
    },
});

export default LoginPhone;
