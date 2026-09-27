import React from "react";
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    onJoin: () => void;
    onLogin: () => void;
    /** Color of "Already have an account?". The landing screen is always light. */
    promptColor?: string;
    style?: StyleProp<ViewStyle>;
    /** Rendered under the log in line, inside the same gap rhythm. */
    children?: React.ReactNode;
};

/**
 * "Join Kindred" plus the "Already have an account? Log in" line from the
 * landing screen. Shared by the login screen and the guest account overlay.
 */
export function AuthCtaBlock({ onJoin, onLogin, promptColor = Colors.light.text, style, children }: Props) {
    const ThemedColor = useThemeColor();
    return (
        <View style={[{ gap: 24, width: "100%" }, style]}>
            <PrimaryButton
                testID="join-kindred-btn"
                title="Join Kindred"
                onPress={onJoin}
                style={{
                    shadowColor: ThemedColor.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    elevation: 6,
                }}
            />
            <ThemedText style={{ textAlign: "center", alignItems: "center" }}>
                <Text style={{ color: promptColor }}>Already have an account? </Text>

                <TouchableOpacity
                    testID="login-link"
                    style={{
                        alignSelf: "center",
                        alignItems: "center",
                    }}
                    onPress={onLogin}>
                    <Text
                        style={{
                            fontWeight: 800,
                            color: ThemedColor.primary,
                            marginBottom: -3,
                        }}>
                        Log in
                    </Text>
                </TouchableOpacity>
            </ThemedText>
            {children}
        </View>
    );
}
