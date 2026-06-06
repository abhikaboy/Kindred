import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform, useColorScheme, LayoutChangeEvent, Keyboard } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useThemeColor } from "@/hooks/useThemeColor";
import { GlassTabItem } from "./GlassTabItem";

// iOS 26+ native Liquid Glass; falls back to BlurView/tint elsewhere.
// Guarded so a dev client without the native module can't crash at import.
let LIQUID_GLASS = false;
try {
    LIQUID_GLASS = isLiquidGlassAvailable();
} catch {
    LIQUID_GLASS = false;
}

const PILL_HEIGHT = 64;
const H_MARGIN = 16;
const INNER_PADDING = 6;
const CAPSULE_INSET = 8;

type Props = BottomTabBarProps & {
    badges?: Record<string, number | undefined>;
    visible?: boolean;
};

// Floating "liquid glass" tab bar: a detached blurred pill with a highlight
// capsule that springs between tabs. Reuses each screen's tabBarIcon option.
export function LiquidGlassTabBar({ state, descriptors, navigation, badges, visible = true }: Props) {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme();
    const insets = useSafeAreaInsets();
    const [contentWidth, setContentWidth] = useState(0);
    const [keyboardUp, setKeyboardUp] = useState(false);

    // Hide the floating pill when the keyboard is open (replaces tabBarHideOnKeyboard).
    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const show = Keyboard.addListener(showEvent, () => setKeyboardUp(true));
        const hide = Keyboard.addListener(hideEvent, () => setKeyboardUp(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    const shown = visible && !keyboardUp;

    const routeCount = state.routes.length;
    const tabWidth = contentWidth > 0 ? contentWidth / routeCount : 0;

    const capsuleX = useSharedValue(0);
    useEffect(() => {
        capsuleX.value = withSpring(state.index * tabWidth, { damping: 18, stiffness: 180, mass: 0.6 });
    }, [state.index, tabWidth]);

    const capsuleStyle = useAnimatedStyle(() => ({
        width: Math.max(tabWidth, 0),
        transform: [{ translateX: capsuleX.value }],
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: withTiming(shown ? 1 : 0, { duration: 300 }),
        transform: [{ translateY: withTiming(shown ? 0 : 120, { duration: 300 }) }],
    }));

    const onContentLayout = (e: LayoutChangeEvent) => setContentWidth(e.nativeEvent.layout.width);

    const isDark = scheme === "dark";
    const borderColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)";
    const glassTint = isDark ? "rgba(28,26,42,0.55)" : "rgba(255,255,255,0.55)";

    return (
        <Animated.View
            pointerEvents={shown ? "box-none" : "none"}
            style={[styles.root, { paddingBottom: insets.bottom + 8 }, containerStyle]}>
            <View
                style={[
                    styles.shadowWrap,
                    {
                        boxShadow: isDark
                            ? "0px 10px 24px rgba(0,0,0,0.55)"
                            : "0px 8px 18px rgba(31,29,46,0.20)",
                    },
                ]}>
                <View
                    style={[
                        styles.pill,
                        {
                            // Faint specular rim so the glass pane has a defined edge on white
                            borderColor: LIQUID_GLASS
                                ? isDark
                                    ? "rgba(255,255,255,0.22)"
                                    : "rgba(255,255,255,0.7)"
                                : borderColor,
                        },
                    ]}>
                    {LIQUID_GLASS ? (
                        <>
                            {/* BlurView gives reliable frost on simulator + device */}
                            <BlurView
                                tint={isDark ? "dark" : "light"}
                                intensity={40}
                                style={[StyleSheet.absoluteFill, { borderRadius: PILL_HEIGHT / 2 }]}
                            />
                            {/* Native Liquid Glass on top for real refraction/specular on device */}
                            <GlassView
                                glassEffectStyle="clear"
                                isInteractive
                                style={[StyleSheet.absoluteFill, { borderRadius: PILL_HEIGHT / 2 }]}
                            />
                        </>
                    ) : (
                        <>
                            {Platform.OS === "ios" ? (
                                <BlurView
                                    tint={isDark ? "dark" : "light"}
                                    intensity={40}
                                    style={StyleSheet.absoluteFill}
                                />
                            ) : null}
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: glassTint }]} />
                        </>
                    )}

                    <View style={styles.content} onLayout={onContentLayout}>
                        {/* Sliding highlight capsule */}
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.capsule,
                                {
                                    // Soft lavender tint behind the active tab
                                    backgroundColor: ThemedColor.primary + (isDark ? "33" : "24"),
                                },
                                capsuleStyle,
                            ]}
                        />

                        {state.routes.map((route, index) => {
                            const { options } = descriptors[route.key];
                            const focused = state.index === index;

                            const onPress = () => {
                                const event = navigation.emit({
                                    type: "tabPress",
                                    target: route.key,
                                    canPreventDefault: true,
                                });
                                if (!focused && !event.defaultPrevented) {
                                    navigation.navigate(route.name as never);
                                }
                            };

                            return (
                                <GlassTabItem
                                    key={route.key}
                                    focused={focused}
                                    onPress={onPress}
                                    renderIcon={options.tabBarIcon}
                                    accessibilityLabel={options.tabBarAccessibilityLabel}
                                    badge={badges?.[route.name]}
                                    invert={route.name !== "(profile)"}
                                />
                            );
                        })}
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: H_MARGIN,
    },
    shadowWrap: {
        borderRadius: PILL_HEIGHT / 2,
        // boxShadow (set inline, theme-aware) renders around the transparent
        // glass box; elevation is the Android fallback.
        elevation: 12,
    },
    pill: {
        height: PILL_HEIGHT,
        borderRadius: PILL_HEIGHT / 2,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
        paddingHorizontal: INNER_PADDING,
    },
    content: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    capsule: {
        position: "absolute",
        left: 0,
        top: CAPSULE_INSET,
        bottom: CAPSULE_INSET,
        borderRadius: (PILL_HEIGHT - 2 * CAPSULE_INSET) / 2,
    },
});
