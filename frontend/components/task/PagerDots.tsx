import React, { useEffect, useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 83;
const MAX_VISIBLE_DOTS = 6;
// Bumped up from the old workspace dots (7/5/3) — position matters more now
// that the whole app (Today/Home/Friends/workspaces) rides on these.
const DOT_ACTIVE = 8;
const DOT_NEAR = 6;
const DOT_FAR = 4;

function getVisibleWindow(total: number, active: number): number[] {
    if (total <= MAX_VISIBLE_DOTS) {
        return Array.from({ length: total }, (_, i) => i);
    }
    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    let start = active - half;
    start = Math.max(0, Math.min(start, total - MAX_VISIBLE_DOTS));
    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, i) => start + i);
}

function getDotSize(dotIndex: number, activeIndex: number): number {
    const dist = Math.abs(dotIndex - activeIndex);
    if (dist === 0) return DOT_ACTIVE;
    if (dist === 1) return DOT_NEAR;
    return DOT_FAR;
}

export const PagerDots: React.FC<{
    count: number;
    activeIndex: number;
    onDotPress: (index: number) => void;
}> = ({ count, activeIndex, onDotPress }) => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const visibleIndices = useMemo(() => getVisibleWindow(count, activeIndex), [count, activeIndex]);

    if (count <= 1) return null;

    return (
        <View style={[styles.dotsContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}>
            <View style={[styles.dotsInner, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}>
                {visibleIndices.map((dotIdx) => (
                    <Dot
                        key={dotIdx}
                        targetSize={getDotSize(dotIdx, activeIndex)}
                        active={dotIdx === activeIndex}
                        onPress={() => onDotPress(dotIdx)}
                    />
                ))}
            </View>
        </View>
    );
};

const Dot: React.FC<{ targetSize: number; active: boolean; onPress: () => void }> = React.memo(
    ({ targetSize, active, onPress }) => {
        const ThemedColor = useThemeColor();
        const size = useSharedValue(targetSize);

        useEffect(() => {
            size.value = withTiming(targetSize, { duration: 200 });
        }, [targetSize]);

        const animatedStyle = useAnimatedStyle(() => ({
            width: size.value,
            height: size.value,
            borderRadius: size.value / 2,
        }));

        return (
            <TouchableOpacity onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} activeOpacity={0.7}>
                <Animated.View
                    style={[animatedStyle, { backgroundColor: active ? ThemedColor.primary : ThemedColor.caption }]}
                />
            </TouchableOpacity>
        );
    }
);

const styles = StyleSheet.create({
    dotsContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 50,
        pointerEvents: "box-none",
    },
    dotsInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
    },
});
