import { View, Text, Dimensions, Image, TouchableOpacity, useColorScheme } from "react-native";
import React, { useState } from "react";
import { getThemedColor } from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { OnboardModal } from "@/components/modals/OnboardModal";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {};

/*
    Landing page when you open the app for the very first time
*/

const index = (props: Props) => {
    let ThemedColor = useThemeColor();
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<"register" | "login">("register");

    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                flexDirection: "column",
            }}>
            <View
                style={{
                    paddingHorizontal: 24,
                    width: "100%",
                    height: "50%",
                    flex: 1,
                    flexDirection: "column",
                }}>
                <View
                    style={{
                        display: "flex",
                        alignSelf: "flex-start",
                        marginTop: Dimensions.get("screen").height / 7,
                    }}>
                    <ThemedText>Welcome to Kindred</ThemedText>
                    <ThemedText
                        type="hero"
                        numberOfLines={2}
                        adjustsFontSizeToFit={true}
                        style={{
                            fontFamily: "Fraunces",
                            fontWeight: 800,
                            fontSize: 48,
                            color: ThemedColor.text,
                        }}>
                        <Text style={{ color: ThemedColor.primary }}>Productive</Text> Meets Social
                    </ThemedText>
                    <ThemedText type="lightBody">
                        Become more productive and organized than ever before while staying connected with all your
                        friends
                    </ThemedText>
                </View>
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
                    <PrimaryButton title="Get Started" onPress={() => setVisible(true)} />
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

export default index;
