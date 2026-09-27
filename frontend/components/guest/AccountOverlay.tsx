import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import Reanimated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthHeroCard } from "@/components/auth/AuthHeroCard";
import { AuthCtaBlock } from "@/components/auth/AuthCtaBlock";
import { OnboardModal } from "@/components/modals/OnboardModal";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { guestTutorialDoneKey } from "@/constants/authStorageKeys";
import {
    closeAccountOverlay,
    dismissAccountOverlay,
    registerAccountOverlayHost,
    setAccountOverlayEligible,
    useAccountOverlay,
    type AccountOverlayDismissMethod,
} from "@/hooks/useAccountOverlay";

// Almost invisible: a short cross-fade with a few points of drift.
const FADE_IN = { duration: 260, easing: Easing.out(Easing.cubic) };
const FADE_OUT = { duration: 200, easing: Easing.out(Easing.cubic) };
const DRIFT = 8;

/**
 * The guest "create an account" moment, drawn over the live app: the landing
 * screen's hero card at the top, its CTA block at the bottom, and the user's
 * own screen showing through a soft scrim in between. Opened through
 * hooks/useAccountOverlay; hidden as soon as the user is no longer a guest.
 */
export function AccountOverlay() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { user, isGuest } = useAuth();
    const { capture } = useAnalytics();
    const { visible, request } = useAccountOverlay();

    const [mounted, setMounted] = useState(visible);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [mode, setMode] = useState<"register" | "login">("register");
    const progress = useSharedValue(0);
    const visibleRef = useRef(visible);
    visibleRef.current = visible;

    useEffect(() => registerAccountOverlayHost(), []);

    // Only a guest who has finished the tutorial is ever prompted.
    const userId = user?._id;
    useEffect(() => {
        if (!userId || !isGuest) {
            setAccountOverlayEligible(false);
            setSheetVisible(false);
            return;
        }
        let cancelled = false;
        AsyncStorage.getItem(guestTutorialDoneKey(userId))
            .then((done) => {
                if (!cancelled) setAccountOverlayEligible(done === "true");
            })
            .catch(() => {
                if (!cancelled) setAccountOverlayEligible(false);
            });
        return () => {
            cancelled = true;
        };
    }, [userId, isGuest]);

    const finishClose = () => {
        // Reopened mid-fade: keep the new session mounted
        if (visibleRef.current) return;
        setMounted(false);
    };

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = withTiming(1, FADE_IN);
            capture(AnalyticsEvents.GUEST_PROMPT_SHOWN, {
                reason: request?.reason,
                surface: request?.surface,
            });
        } else {
            progress.value = withTiming(0, FADE_OUT, (finished) => {
                if (finished) runOnJS(finishClose)();
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const dismiss = (method: AccountOverlayDismissMethod) => {
        if (!visibleRef.current) return;
        capture(AnalyticsEvents.GUEST_PROMPT_DISMISSED, {
            reason: request?.reason,
            surface: request?.surface,
            method,
        });
        dismissAccountOverlay();
    };

    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            dismiss("back");
            return true;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, request]);

    // Leaving the overlay for the sign-up flow: the sheet navigates on its own,
    // the overlay just gets out of the way once the account exists.
    useEffect(() => {
        if (!isGuest) closeAccountOverlay();
    }, [isGuest]);

    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const heroStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: (1 - progress.value) * -DRIFT }],
    }));
    const ctaStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: (1 - progress.value) * DRIFT }],
    }));

    if (!mounted) return null;

    const bg = ThemedColor.background;

    const openSheet = (next: "register" | "login") => {
        setMode(next);
        // Force a state cycle so the sheet's effect always fires,
        // even if visible is stuck true from a stale dismiss
        setSheetVisible(false);
        setTimeout(() => setSheetVisible(true), 50);
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "box-none" : "none"}>
            {/* Soft scrim: the live screen stays readable in the middle and
                settles into the page color behind the buttons. */}
            <Reanimated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => dismiss("scrim")}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss">
                    <LinearGradient
                        colors={[bg + "B3", bg + "73", bg + "73", bg + "F2", bg]}
                        locations={[0, 0.4, 0.58, 0.76, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                </Pressable>
            </Reanimated.View>

            <View style={styles.column} pointerEvents="box-none">
                <Reanimated.View style={heroStyle}>
                    <AuthHeroCard
                        style={{
                            marginTop: insets.top,
                            height: "auto",
                            paddingTop: 24,
                            paddingBottom: 12,
                        }}
                    />
                </Reanimated.View>

                <Reanimated.View
                    style={[
                        ctaStyle,
                        {
                            paddingHorizontal: HORIZONTAL_PADDING,
                            paddingBottom: insets.bottom + 16,
                        },
                    ]}>
                    <AuthCtaBlock
                        promptColor={ThemedColor.text}
                        onJoin={() => openSheet("register")}
                        onLogin={() => openSheet("login")}>
                        <TouchableOpacity
                            testID="account-overlay-not-now"
                            onPress={() => dismiss("not_now")}
                            hitSlop={12}
                            activeOpacity={0.6}
                            style={{ alignSelf: "center" }}>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                Not now
                            </ThemedText>
                        </TouchableOpacity>
                    </AuthCtaBlock>
                </Reanimated.View>
            </View>

            <OnboardModal
                visible={sheetVisible}
                setVisible={setSheetVisible}
                mode={mode}
                onSwitchMode={(next) => {
                    setMode(next);
                    setTimeout(() => setSheetVisible(true), 300);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    column: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "space-between",
    },
});
