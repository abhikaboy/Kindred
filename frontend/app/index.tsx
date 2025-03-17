import { View, Text, Dimensions, Image, TouchableOpacity } from "react-native";
import React from "react";
import ThemedColor from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";

type Props = {};

/*
    Landing page when you open the app for the very first time

*/

const index = (props: Props) => {
    const router = useRouter();

    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                flexDirection: "column",
            }}>
            <Image
                source={require("../assets/images/onboardHero.png")}
                style={{
                    width: Dimensions.get("screen").width,
                }}></Image>
            <View
                style={{
                    paddingHorizontal: 24,
                    width: "100%",
                    height: "50%",
                    flex: 1,
                    flexDirection: "column",
                }}>
                <View style={{ display: "flex", alignSelf: "flex-start" }}>
                    <ThemedText type="hero" numberOfLines={2} adjustsFontSizeToFit={true}>
                        PRODUCTIVE MEETS SOCIAL
                    </ThemedText>
                    <ThemedText type="lightBody">
                        Become more productive and organized than ever before while staying connected with all your
                        friends
                    </ThemedText>
                </View>

                <View
                    style={{
                        flex: 1,
                        flexDirection: "column",
                        gap: 24,
                        width: "100%",
                        justifyContent: "flex-end",
                        bottom: 64,
                    }}>
                    <PrimaryButton title="Get Started" onPress={() => router.push("/login")} />
                    <ThemedText style={{ textAlign: "center" }}>
                        Already have an account?{" "}
                        <TouchableOpacity>
                            <Text style={{ fontWeight: 800, color: "white" }}> Log in</Text>
                        </TouchableOpacity>
                    </ThemedText>
                </View>
            </View>
        </View>
    );
};

export default index;
