import React, { useCallback } from "react";
import { View, ScrollView, StyleSheet, Platform } from "react-native";
import Popover, { PopoverPlacement } from "react-native-popover-view";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { router, type Href } from "expo-router";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { WorkspaceSwitcherList } from "./WorkspaceSwitcherList";

// iOS 26+ native Liquid Glass; falls back to BlurView elsewhere. Guarded so a
// dev client without the native module can't crash at import. (mirrors LiquidGlassTabBar)
let LIQUID_GLASS = false;
try {
    LIQUID_GLASS = isLiquidGlassAvailable();
} catch {
    LIQUID_GLASS = false;
}

const TASK_ROUTE = "/(logged-in)/(tabs)/(task)" as Href;
const CALENDAR_ROUTE = "/(logged-in)/(tabs)/(task)/daily" as Href;

type Props = {
    isVisible: boolean;
    onClose: () => void;
    // Anchor the popover (and its caret) to the long-pressed tab.
    from: React.RefObject<any>;
};

// Glassy floating switcher anchored above the pencil tab. Holds the app wiring
// (tasks context + router); the list itself is presentational.
export function WorkspaceSwitcherPopover({ isVisible, onClose, from }: Props) {
    const ThemedColor = useThemeColor();
    const { workspaces, selected, setSelected } = useTasks();
    const isDark = ThemedColor.background === "#13121F";

    const navigate = useCallback(
        (route: Href, workspaceName?: string) => {
            onClose();
            requestAnimationFrame(() => {
                if (workspaceName !== undefined) setSelected(workspaceName);
                router.navigate(route);
            });
        },
        [onClose, setSelected]
    );

    return (
        <Popover
            isVisible={isVisible}
            from={from}
            onRequestClose={onClose}
            placement={PopoverPlacement.TOP}
            arrowSize={{ width: 16, height: 8 }}
            backgroundStyle={styles.backdrop}
            popoverStyle={[
                styles.popover,
                { borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)" },
            ]}>
            {/* Frost + a light translucent tint so the panel reads as glass
                (not opaque) while staying legible over the dimmed content. */}
            {Platform.OS === "ios" ? (
                <BlurView tint={isDark ? "dark" : "light"} intensity={24} style={StyleSheet.absoluteFill} />
            ) : null}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: isDark ? "rgba(34,30,52,0.32)" : "rgba(255,255,255,0.34)" },
                ]}
            />
            {LIQUID_GLASS ? (
                <GlassView glassEffectStyle="clear" style={StyleSheet.absoluteFill} />
            ) : null}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>
                <WorkspaceSwitcherList
                    workspaces={workspaces}
                    selected={selected}
                    onSelectCalendar={() => navigate(CALENDAR_ROUTE)}
                    onSelectWorkspace={(name) => navigate(TASK_ROUTE, name)}
                />
            </ScrollView>
        </Popover>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        // No dim — the nav bar and content stay bright; the tinted glass +
        // shadow provide separation. Still captures taps to dismiss.
        backgroundColor: "transparent",
    },
    popover: {
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
        width: 260,
        boxShadow: "0px 12px 30px rgba(31,29,46,0.28)",
        elevation: 14,
    },
    scroll: {
        // ~5-6 rows tall, then scrolls internally
        maxHeight: 320,
    },
    content: {
        padding: 8,
    },
});
