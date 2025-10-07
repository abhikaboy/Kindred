import { View, Text, Dimensions, Image, TouchableOpacity, useColorScheme } from "react-native";
import React, { useEffect, useState } from "react";
import { Colors, getThemedColor } from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ErrorBoundaryProps, Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { OnboardModal } from "@/components/modals/OnboardModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type Props = {};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background }}>
            <ThemedText type="heading">login</ThemedText>
            <ThemedText type="default">{error.message}</ThemedText>
            <ThemedText type="default">{error.stack}</ThemedText>
            <ThemedText type="default">{error.name}</ThemedText>
            <ThemedText type="default" onPress={retry}>
                Try Again?
            </ThemedText>
        </View>
    );
}

/*
    Landing page when you open the app for the very first time
*/

const login = (props: Props) => {
    let ThemedColor = useThemeColor();
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<"register" | "login">("register");
    const { user } = useAuth();
    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user]);

    return (
        <View
            style={{
                backgroundColor: Colors.light.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                flexDirection: "column",
            }}>
            <View
                style={{
                    backgroundColor: Colors.dark.background,
                    height: Dimensions.get("screen").height * 0.4,
                    width: "95%",
                    alignSelf: "center",
                    borderRadius: 56,
                    marginTop: 12,
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: Dimensions.get("screen").height * 0.06,
                }}>
                <View
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: Colors.light.background,
                    }}>
                    <ThemedText type="lightBody" style={{ color: Colors.dark.text }}>
                        Beta
                    </ThemedText>
                </View>
                <ThemedText
                    type="titleFraunces"
                    style={{
                        color: Colors.dark.text,
                        fontWeight: 600,
                        letterSpacing: -2,
                        justifyContent: "center",
                        alignItems: "center",
                        textAlign: "center",
                        marginTop: Dimensions.get("screen").height * 0.03,
                        fontSize: 64,
                    }}>
                    kindred
                </ThemedText>
                <ThemedText
                    type="lightBody"
                    style={{
                        color: Colors.dark.text,
                        fontFamily: "Outfit",
                        fontSize: 20,
                        fontStyle: "italic",
                    }}>
                    social productivity
                </ThemedText>
                <Image
                    source={require("../assets/images/Checkmark.png")}
                    style={{
                        width: 50,
                        resizeMode: "contain",
                    }}></Image>
            </View>
            <View
                style={{
                    paddingHorizontal: HORIZONTAL_PADDING,
                    width: "100%",
                    height: "50%",
                    flex: 1,
                    flexDirection: "column",
                }}>
                <Image
                    source={require("../assets/images/onboardinghero.png")}
                    style={{
                        width: Dimensions.get("screen").width,
                        resizeMode: "contain",
                        left: 0,
                        position: "absolute",
                        height: Dimensions.get("screen").height / 1.25,
                        bottom: -50,
                    }}></Image>
                <View
                    style={{
                        flex: 1,
                        flexDirection: "column",
                        gap: 24,
                        width: "100%",
                        justifyContent: "flex-end",
                        bottom: 64,
                    }}>
                    <OnboardModal visible={visible} setVisible={setVisible} mode={mode} />
                    <PrimaryButton 
                        title="Join Kindred" 
                        onPress={() => {
                            setMode("register");
                            setVisible(true);
                        }} 
                    />
                    <ThemedText style={{ textAlign: "center", alignItems: "flex-end" }}>
                        Already have an account?{" "}
                        <TouchableOpacity
                            style={{
                                alignSelf: "flex-end",
                                alignItems: "flex-end",
                            }}
                            onPress={() => {
                                setMode("login");
                                setVisible(true);
                            }}>
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
                </View>
            </View>
        </View>
    );
};

export default login;
