import React, { useCallback, useState } from "react";
import { StyleSheet, TextStyle, TouchableOpacity, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CaretDown } from "phosphor-react-native";

const ANIMATION_DURATION = 250;
const TIMING_CONFIG = { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) };

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
    titleStyle?: TextStyle;
    titleType?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link" | "caption";
}

export function CollapsibleSection({
    title,
    children,
    defaultCollapsed = false,
    titleStyle,
    titleType = "subtitle",
}: CollapsibleSectionProps) {
    const ThemedColor = useThemeColor();
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const measuredHeight = useSharedValue(0);
    const animatedHeight = useSharedValue(defaultCollapsed ? 0 : -1);
    const chevronRotation = useSharedValue(defaultCollapsed ? -90 : 0);
    const hasMeasured = useSharedValue(false);

    const onContentLayout = useCallback(
        (e: { nativeEvent: { layout: { height: number } } }) => {
            const h = e.nativeEvent.layout.height;
            if (h === 0) return;
            measuredHeight.value = h;
            if (!hasMeasured.value) {
                hasMeasured.value = true;
                animatedHeight.value = defaultCollapsed ? 0 : h;
            }
        },
        [measuredHeight, animatedHeight, hasMeasured, defaultCollapsed],
    );

    const toggle = useCallback(() => {
        const willCollapse = !collapsed;
        setCollapsed(willCollapse);
        animatedHeight.value = withTiming(willCollapse ? 0 : measuredHeight.value, TIMING_CONFIG);
        chevronRotation.value = withTiming(willCollapse ? -90 : 0, TIMING_CONFIG);
    }, [collapsed, animatedHeight, measuredHeight, chevronRotation]);

    const contentStyle = useAnimatedStyle(() => {
        if (animatedHeight.value < 0) return {};
        return {
            height: animatedHeight.value,
            overflow: "hidden" as const,
        };
    });

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${chevronRotation.value}deg` }],
    }));

    return (
        <View>
            <TouchableOpacity style={styles.titleRow} onPress={toggle} activeOpacity={0.7}>
                <ThemedText type={titleType} style={[styles.titleText, titleStyle]}>
                    {title}
                </ThemedText>
                <Animated.View style={[styles.chevron, chevronStyle]}>
                    <CaretDown size={18} color={ThemedColor.caption} weight="bold" />
                </Animated.View>
            </TouchableOpacity>

            {/* Hidden measurer -- always mounted so we track content size */}
            <View style={styles.measurer} pointerEvents="none">
                {children}
            </View>

            {/* Visible animated container */}
            <Animated.View style={contentStyle}>
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    titleText: {
        fontSize: 20,
        fontWeight: "500",
        letterSpacing: 0.2,
    },
    chevron: {
        padding: 4,
    },
    measurer: {
        position: "absolute",
        opacity: 0,
        left: 0,
        right: 0,
    },
});
