import { View, Dimensions, Animated } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Colors } from "@/constants/Colors";
import { ErrorBoundaryProps, useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { OnboardModal } from "@/components/modals/OnboardModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { AuthHeroCard } from "@/components/auth/AuthHeroCard";
import { AuthCtaBlock } from "@/components/auth/AuthCtaBlock";

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
    const params = useLocalSearchParams<{ mode?: string }>();
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<"register" | "login">(params.mode === "login" ? "login" : "register");
    const { user } = useAuth();

    // Two staggered animations: image slide-up, buttons fade
    const imageFade = useRef(new Animated.Value(0)).current;
    const imageSlide = useRef(new Animated.Value(20)).current;
    const buttonsFade = useRef(new Animated.Value(0)).current;

    // Guests arrive from Home's "Log in" link with mode=login; open the sheet once the screen is up
    useEffect(() => {
        if (params.mode !== "login") return;
        const t = setTimeout(() => setVisible(true), 300);
        return () => clearTimeout(t);
    }, []);

    // A guest can land here to sign into a real account; only bounce once they have.
    useEffect(() => {
        if (user && !user.isGuest) {
            router.push("/");
        }
    }, [user]);

    useEffect(() => {
        Animated.stagger(200, [
            Animated.parallel([
                Animated.timing(imageFade, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(imageSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
            Animated.timing(buttonsFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <View
            style={{
                backgroundColor: Colors.light.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                flexDirection: "column",
            }}>
            <AuthHeroCard />
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
                        opacity: imageFade,
                        transform: [{ translateY: imageSlide }],
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
                    }}>
                    <OnboardModal
                        visible={visible}
                        setVisible={setVisible}
                        mode={mode}
                        onSwitchMode={(next) => {
                            setMode(next);
                            setTimeout(() => setVisible(true), 300);
                        }}
                    />
                    <AuthCtaBlock
                        onJoin={() => {
                            setMode("register");
                            // Force a state cycle so the useEffect always fires,
                            // even if visible is stuck true from a stale dismiss
                            setVisible(false);
                            setTimeout(() => setVisible(true), 50);
                        }}
                        onLogin={() => {
                            setMode("login");
                            setVisible(false);
                            setTimeout(() => setVisible(true), 50);
                        }}
                    />
                </Animated.View>
            </View>
        </View>
    );
};

export default login;
