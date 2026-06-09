import React from "react";
import { Pressable, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type IconRenderer = (props: { focused: boolean; color: string; size: number }) => React.ReactNode;

type Props = {
    focused: boolean;
    onPress: () => void;
    onLongPress?: () => void;
    renderIcon?: IconRenderer;
    accessibilityLabel?: string;
    badge?: number;
    // Badge background; defaults to brand primary. Use a red for alerts.
    badgeColor?: string;
    // When true, inactive icons invert against the backdrop (difference blend)
    // so they stay legible over any content behind the glass. Off for avatars.
    invert?: boolean;
};

// A single tab slot: renders the route's icon (reused from the screen's
// tabBarIcon option) with a light haptic on press and an optional count badge.
// Forwards a ref to its Pressable so callers can anchor a popover to the tab.
export const GlassTabItem = React.forwardRef<View, Props>(function GlassTabItem(
    { focused, onPress, onLongPress, renderIcon, accessibilityLabel, badge, badgeColor, invert = true },
    ref
) {
    const ThemedColor = useThemeColor();
    const isDark = ThemedColor.background === "#13121F";
    // Active icon is brand purple. Inactive icons take the theme's text color
    // with an opposite-tone glow so they stay legible over any backdrop.
    const glowing = invert && !focused;
    const color = focused ? ThemedColor.primary : ThemedColor.text;
    const glow = isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.95)";

    const handlePress = async () => {
        if (Platform.OS === "ios") {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {
                // haptics are best-effort
            }
        }
        onPress();
    };

    const handleLongPress = async () => {
        if (!onLongPress) return;
        if (Platform.OS === "ios") {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {
                // haptics are best-effort
            }
        }
        onLongPress();
    };

    return (
        <Pressable
            ref={ref}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={accessibilityLabel}
            onPress={handlePress}
            onLongPress={onLongPress ? handleLongPress : undefined}
            style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
            }}>
            <View
                style={{
                    alignItems: "center",
                    justifyContent: "center",
                    ...(glowing
                        ? { filter: [{ dropShadow: `0px 0px 2px ${glow}` }, { dropShadow: `0px 0px 3px ${glow}` }] }
                        : null),
                }}>
                {renderIcon?.({ focused, color, size: 24 })}
                {badge !== undefined && badge > 0 && (
                    <View
                        style={{
                            position: "absolute",
                            top: -8,
                            right: -12,
                            minWidth: 18,
                            height: 18,
                            paddingHorizontal: 5,
                            borderRadius: 9,
                            backgroundColor: badgeColor ?? ThemedColor.primary,
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                        <ThemedText
                            type="caption"
                            style={{ color: "#FFFFFF", fontSize: 11, lineHeight: 14 }}>
                            {badge > 99 ? "99+" : badge}
                        </ThemedText>
                    </View>
                )}
            </View>
        </Pressable>
    );
});
