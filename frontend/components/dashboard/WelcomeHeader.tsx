import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { GearSix, Moon } from "phosphor-react-native";
import { setFocusButtonRect } from "@/hooks/useFocusButtonRect";
import { QuietPressable } from "@/components/ui/QuietPressable";

interface WelcomeHeaderProps {
    userName?: string;
    ThemedColor: any;
    onSettingsPress: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
}

const greetingFor = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
    userName,
    ThemedColor,
    onSettingsPress,
    focusMode,
    onToggleFocusMode,
}) => {
    const focusBtnRef = useRef<View>(null);
    // Publish where the moon button sits so the intro tour can point at it
    const publishFocusRect = () => {
        focusBtnRef.current?.measureInWindow((x, y, width, height) => {
            if (width > 0) setFocusButtonRect({ x, y, width, height });
        });
    };
    const greeting = greetingFor(new Date().getHours());

    return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.headerContainer}>
            <View style={styles.headerRow}>
                <ThemedText type="caption">{greeting}</ThemedText>
                <ThemedText type="titleFraunces" numberOfLines={1}>
                    {userName || "there"}
                </ThemedText>
            </View>

            <View style={styles.actions}>
                <QuietPressable
                    ref={focusBtnRef}
                    onLayout={publishFocusRect}
                    onPress={onToggleFocusMode}
                    hitSlop={8}
                    accessibilityLabel="Focus mode"
                    style={[styles.iconBtn, { backgroundColor: focusMode ? ThemedColor.primary + "14" : "transparent" }]}>
                    <Moon
                        size={20}
                        color={focusMode ? ThemedColor.primary : ThemedColor.caption}
                        weight={focusMode ? "fill" : "regular"}
                    />
                </QuietPressable>
                <QuietPressable
                    onPress={onSettingsPress}
                    hitSlop={8}
                    accessibilityLabel="Settings"
                    style={styles.iconBtn}>
                    <GearSix size={20} color={ThemedColor.caption} />
                </QuietPressable>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingTop: 24,
        paddingBottom: 16,
    },
    headerRow: {
        flex: 1,
        gap: 4,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
});
