import React, { useEffect, useMemo } from "react";
import { View, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { CalendarBlank, House, UsersThree } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticSelect } from "@/utils/haptics";

const TAB_BAR_HEIGHT = 83;
// Special pages are always shown; only the workspace dots are windowed.
const MAX_VISIBLE_WORKSPACE_DOTS = 5;
const DOT_SIZE = 8;
const DOT_NEAR = 6;
const DOT_FAR = 4;
const ACTIVE_PILL_WIDTH = 20;
const ICON_SIZE = 18;
// Fixed touch box so tiny far dots are still easy to hit.
const DOT_TOUCH_WIDTH = 16;
const DOT_TOUCH_HEIGHT = 32;
const INACTIVE_DOT_OPACITY = 0.4;

export type PagerKind = "today" | "home" | "friends" | "workspace";

const SPECIAL_ICONS = {
    today: CalendarBlank,
    home: House,
    friends: UsersThree,
} as const;

function getVisibleWindow(indices: number[], active: number): number[] {
    if (indices.length <= MAX_VISIBLE_WORKSPACE_DOTS) return indices;
    const activePos = Math.max(0, indices.indexOf(active));
    const half = Math.floor(MAX_VISIBLE_WORKSPACE_DOTS / 2);
    const start = Math.max(0, Math.min(activePos - half, indices.length - MAX_VISIBLE_WORKSPACE_DOTS));
    return indices.slice(start, start + MAX_VISIBLE_WORKSPACE_DOTS);
}

function getDotSize(dotIndex: number, activeIndex: number, firstWorkspaceIndex: number): number {
    // While on a special page, measure distance from the first workspace so the
    // leading dots stay readable.
    const anchor = Math.max(activeIndex, firstWorkspaceIndex);
    const dist = Math.abs(dotIndex - anchor);
    if (dist <= 1) return DOT_SIZE;
    if (dist === 2) return DOT_NEAR;
    return DOT_FAR;
}

export const PagerDots = React.memo<{
    kinds: PagerKind[];
    /** Per-page accent colour; workspace dots use it, falling back to primary. */
    colors: (string | null | undefined)[];
    activeIndex: number;
    onDotPress: (index: number) => void;
}>(function PagerDots({ kinds, colors, activeIndex, onDotPress }) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    // White pops against the light glow; in dark mode the page background is
    // darker than the card surface, so lift the pill with `lightened` instead.
    const isDark = useColorScheme() === "dark";

    const specialIndices = useMemo(() => kinds.flatMap((k, i) => (k === "workspace" ? [] : [i])), [kinds]);
    const workspaceIndices = useMemo(() => kinds.flatMap((k, i) => (k === "workspace" ? [i] : [])), [kinds]);
    const visibleWorkspaces = useMemo(
        () => getVisibleWindow(workspaceIndices, activeIndex),
        [workspaceIndices, activeIndex]
    );

    if (kinds.length <= 1) return null;

    return (
        <View style={[styles.container, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}>
            <View
                style={[
                    styles.inner,
                    { backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background, borderColor: ThemedColor.tertiary },
                ]}>
                {specialIndices.map((idx) => (
                    <SpecialIcon
                        key={idx}
                        kind={kinds[idx] as keyof typeof SPECIAL_ICONS}
                        active={idx === activeIndex}
                        index={idx}
                        onPress={onDotPress}
                    />
                ))}
                {visibleWorkspaces.length > 0 && (
                    <View style={[styles.divider, { backgroundColor: ThemedColor.tertiary }]} />
                )}
                {visibleWorkspaces.map((idx) => (
                    <Dot
                        key={idx}
                        targetSize={getDotSize(idx, activeIndex, workspaceIndices[0])}
                        active={idx === activeIndex}
                        color={colors[idx] || ThemedColor.primary}
                        index={idx}
                        onPress={onDotPress}
                    />
                ))}
            </View>
        </View>
    );
});

const SpecialIcon: React.FC<{
    kind: keyof typeof SPECIAL_ICONS;
    active: boolean;
    index: number;
    onPress: (index: number) => void;
}> = React.memo(({ kind, active, index, onPress }) => {
    const ThemedColor = useThemeColor();
    const Icon = SPECIAL_ICONS[kind];
    return (
        <TouchableOpacity
            onPress={() => {
                if (!active) hapticSelect();
                onPress(index);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={kind}
            accessibilityState={{ selected: active }}
            style={[styles.iconWrap, active && { backgroundColor: ThemedColor.primary + "1F" }]}>
            <Icon
                size={ICON_SIZE}
                color={active ? ThemedColor.primary : ThemedColor.caption}
                weight={active ? "fill" : "regular"}
            />
        </TouchableOpacity>
    );
});

const Dot: React.FC<{
    targetSize: number;
    active: boolean;
    color: string;
    index: number;
    onPress: (index: number) => void;
}> = React.memo(({ targetSize, active, color, index, onPress }) => {
    const size = useSharedValue(targetSize);
    const width = useSharedValue(active ? ACTIVE_PILL_WIDTH : targetSize);
    const opacity = useSharedValue(active ? 1 : INACTIVE_DOT_OPACITY);

    useEffect(() => {
        size.value = withTiming(targetSize, { duration: 200 });
        width.value = withTiming(active ? ACTIVE_PILL_WIDTH : targetSize, { duration: 200 });
        opacity.value = withTiming(active ? 1 : INACTIVE_DOT_OPACITY, { duration: 200 });
    }, [targetSize, active]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: width.value,
        height: size.value,
        borderRadius: size.value / 2,
        opacity: opacity.value,
    }));

    return (
        <TouchableOpacity
            onPress={() => {
                if (!active) hapticSelect();
                onPress(index);
            }}
            hitSlop={{ top: 4, bottom: 4 }}
            activeOpacity={0.7}
            style={[styles.dotTouch, active && { minWidth: ACTIVE_PILL_WIDTH }]}>
            <Animated.View style={[animatedStyle, { backgroundColor: color }]} />
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 50,
        pointerEvents: "box-none",
    },
    inner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 24,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    dotTouch: {
        minWidth: DOT_TOUCH_WIDTH,
        height: DOT_TOUCH_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
    },
    divider: {
        width: 1,
        height: 16,
        marginHorizontal: 4,
    },
});
