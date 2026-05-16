import { View, Text, Dimensions, Image, TouchableOpacity, Animated } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Colors } from "@/constants/Colors";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ErrorBoundaryProps, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { OnboardModal } from "@/components/modals/OnboardModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

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

    // Animations
    const titleFade = useRef(new Animated.Value(0)).current;
    const subtitleFade = useRef(new Animated.Value(0)).current;
    const checkmarkFade = useRef(new Animated.Value(0)).current;
    const checkmarkScale = useRef(new Animated.Value(0.6)).current;
    const heroImageFade = useRef(new Animated.Value(0)).current;
    const heroImageSlide = useRef(new Animated.Value(60)).current;
    const buttonsFade = useRef(new Animated.Value(0)).current;
    const buttonsSlide = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user]);

    useEffect(() => {
        // Staggered entrance animations
        Animated.sequence([
            // Title fades in
            Animated.timing(titleFade, { toValue: 1, duration: 500, useNativeDriver: true }),
            // Subtitle fades in
            Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            // Checkmark pops in
            Animated.parallel([
                Animated.timing(checkmarkFade, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(checkmarkScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
            ]),
        ]).start();

        // Hero image slides up and fades in
        Animated.parallel([
            Animated.timing(heroImageFade, { toValue: 1, duration: 700, delay: 300, useNativeDriver: true }),
            Animated.timing(heroImageSlide, { toValue: 0, duration: 700, delay: 300, useNativeDriver: true }),
        ]).start();

        // Buttons slide up from bottom
        Animated.parallel([
            Animated.timing(buttonsFade, { toValue: 1, duration: 500, delay: 600, useNativeDriver: true }),
            Animated.timing(buttonsSlide, { toValue: 0, duration: 500, delay: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    // Landing page is always light mode
    const heroCardBg = Colors.dark.background;
    const heroCardText = Colors.dark.text;

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
                    backgroundColor: heroCardBg,
                    height: Dimensions.get("screen").height * 0.4,
                    width: "95%",
                    alignSelf: "center",
                    borderRadius: 56,
                    marginTop: 12,
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: Dimensions.get("screen").height * 0.06,
                }}>
                <Animated.View style={{ opacity: titleFade }}>
                    <ThemedText
                        type="titleFraunces"
                        style={{
                            color: heroCardText,
                            fontWeight: 600,
                            letterSpacing: -2,
                            justifyContent: "center",
                            alignItems: "center",
                            textAlign: "center",
                            marginTop: Dimensions.get("screen").height * 0.02,
                            fontSize: 64,
                        }}>
                        kindred
                    </ThemedText>
                </Animated.View>
                <Animated.View style={{
                    opacity: subtitleFade,
                    paddingHorizontal: 48,
                    marginTop: 8,
                }}>
                    <ThemedText
                        type="lightBody"
                        style={{
                            color: heroCardText,
                            fontFamily: "Outfit",
                            fontSize: 16,
                            textAlign: "center",
                            lineHeight: 22,
                            opacity: 0.8,
                        }}>
                        because doing it alone was never actually the plan
                    </ThemedText>
                </Animated.View>
                <Animated.View style={{
                    opacity: checkmarkFade,
                    transform: [{ scale: checkmarkScale }],
                    marginTop: 12,
                }}>
                    <Image
                        source={require("../assets/images/Checkmark.png")}
                        style={{
                            width: 50,
                            resizeMode: "contain",
                        }}
                    />
                </Animated.View>
            </View>
            <View
                style={{
                    paddingHorizontal: HORIZONTAL_PADDING,
                    width: "100%",
                    height: "50%",
                    flex: 1,
                    flexDirection: "column",
                }}>
                <Animated.Image
                    source={require("../assets/images/onboardinghero.png")}
                    style={{
                        width: Dimensions.get("screen").width,
                        resizeMode: "contain",
                        left: 0,
                        position: "absolute",
                        height: Dimensions.get("screen").height / 1.25,
                        bottom: -50,
                        opacity: heroImageFade,
                        transform: [{ translateY: heroImageSlide }],
                    }}
                />
                <Animated.View
                    style={{
                        flex: 1,
                        flexDirection: "column",
                        gap: 24,
                        width: "100%",
                        justifyContent: "flex-end",
                        bottom: 64,
                        opacity: buttonsFade,
                        transform: [{ translateY: buttonsSlide }],
                    }}>
                    <OnboardModal visible={visible} setVisible={setVisible} mode={mode} />
                    <PrimaryButton
                        testID="join-kindred-btn"
                        title="Join Kindred"
                        onPress={() => {
                            setMode("register");
                            // Force a state cycle so the useEffect always fires,
                            // even if visible is stuck true from a stale dismiss
                            setVisible(false);
                            setTimeout(() => setVisible(true), 50);
                        }}
                        style={{
                            shadowColor: ThemedColor.primary,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.3,
                            shadowRadius: 10,
                            elevation: 6,
                        }}
                    />
                    <ThemedText style={{ textAlign: "center", alignItems: "center" }}>
                        <Text style={{ color: Colors.light.text }}>
                            Already have an account?{" "}
                        </Text>

                        <TouchableOpacity
                            testID="login-link"
                            style={{
                                alignSelf: "center",
                                alignItems: "center",
                            }}
                            onPress={() => {
                                setMode("login");
                                setVisible(false);
                                setTimeout(() => setVisible(true), 50);
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
                </Animated.View>
            </View>
        </View>
    );
};

export default login;
