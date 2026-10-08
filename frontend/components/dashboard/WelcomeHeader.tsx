import React, { useRef } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Bell, GearSix, Moon } from "phosphor-react-native";
import { setFocusButtonRect } from "@/hooks/useFocusButtonRect";
import { useNotifications } from "@/hooks/useNotifications";
import { ThemedText } from "@/components/ThemedText";

interface WelcomeHeaderProps {
    ThemedColor: any;
    onSettingsPress: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
}

// Home's top bar: settings, focus mode, notifications. The greeting itself lives in the focus stage.
export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ ThemedColor, onSettingsPress, focusMode, onToggleFocusMode }) => {
    const focusBtnRef = useRef<View>(null);
    const { unreadCount } = useNotifications();
    // Publish where the moon button sits so the intro tour can point at it
    const publishFocusRect = () => {
        focusBtnRef.current?.measureInWindow((x, y, width, height) => {
            if (width > 0) setFocusButtonRect({ x, y, width, height });
        });
    };

    return (
        <View style={styles.actions}>
            <TouchableOpacity onPress={onSettingsPress} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Settings" style={styles.btn}>
                <GearSix size={22} color={ThemedColor.caption} />
            </TouchableOpacity>
            <TouchableOpacity
                ref={focusBtnRef}
                onLayout={publishFocusRect}
                onPress={onToggleFocusMode}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Focus mode"
                style={styles.btn}>
                <Moon size={22} color={focusMode ? ThemedColor.primary : ThemedColor.caption} weight={focusMode ? "fill" : "regular"} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => router.navigate("/(logged-in)/(tabs)/(feed)/feed?page=notifications")}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Notifications"
                style={styles.btn}>
                <Bell size={22} color={ThemedColor.caption} />
                {unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: ThemedColor.error ?? "#E5484D" }]}>
                        <ThemedText type="caption" style={styles.badgeText}>
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </ThemedText>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 10,
        paddingTop: 12,
        paddingBottom: 4,
    },
    btn: { padding: 4 },
    badge: {
        position: "absolute",
        top: 0,
        right: 0,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
    },
    badgeText: { color: "white", fontSize: 9, lineHeight: 11 },
});
