import React from "react";
import { Pressable, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type IconRenderer = (props: { focused: boolean; color: string; size: number }) => React.ReactNode;

type Props = {
    focused: boolean;
    onPress: () => void;
    renderIcon?: IconRenderer;
    accessibilityLabel?: string;
    badge?: number;
    // When true, inactive icons invert against the backdrop (difference blend)
    // so they stay legible over any content behind the glass. Off for avatars.
    invert?: boolean;
};

// A single tab slot: renders the route's icon (reused from the screen's
// tabBarIcon option) with a light haptic on press and an optional count badge.
export function GlassTabItem({ focused, onPress, renderIcon, accessibilityLabel, badge, invert = true }: Props) {
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

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={accessibilityLabel}
            onPress={handlePress}
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
                            backgroundColor: ThemedColor.primary,
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
}
