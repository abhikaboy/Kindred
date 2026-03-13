import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import PagerView from "react-native-pager-view";
import { WorkspaceContent } from "./WorkspaceContent";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from "react-native-reanimated";
import type { Workspace } from "@/api/types";

const TAB_BAR_HEIGHT = 83;
const MAX_VISIBLE_DOTS = 5;
const DOT_ACTIVE = 7;
const DOT_NEAR = 5;
const DOT_FAR = 3;

interface WorkspacePagerProps {
    workspaces: Workspace[];
    selected: string;
    onWorkspaceChange: (name: string) => void;
}

export const WorkspacePager: React.FC<WorkspacePagerProps> = ({
    workspaces,
    selected,
    onWorkspaceChange,
}) => {
    const pagerRef = useRef<PagerView>(null);
    const isExternalChange = useRef(false);

    const selectedIndex = workspaces.findIndex((ws) => ws.name === selected);
    const [activeIndex, setActiveIndex] = useState(
        selectedIndex >= 0 ? selectedIndex : 0
    );

    useEffect(() => {
        const newIndex = workspaces.findIndex((ws) => ws.name === selected);
        if (newIndex >= 0 && newIndex !== activeIndex) {
            isExternalChange.current = true;
            setActiveIndex(newIndex);
            pagerRef.current?.setPage(newIndex);
        }
    }, [selected, workspaces]);

    const onPageSelected = useCallback(
        (e: { nativeEvent: { position: number } }) => {
            const position = e.nativeEvent.position;
            setActiveIndex(position);

            if (isExternalChange.current) {
                isExternalChange.current = false;
                return;
            }

            const workspace = workspaces[position];
            if (workspace && workspace.name !== selected) {
                onWorkspaceChange(workspace.name);
            }
        },
        [workspaces, selected, onWorkspaceChange]
    );

    if (workspaces.length === 0) return null;

    return (
        <View style={styles.container}>
            <PagerView
                ref={pagerRef}
                style={styles.pager}
                initialPage={selectedIndex >= 0 ? selectedIndex : 0}
                onPageSelected={onPageSelected}
                offscreenPageLimit={1}
            >
                {workspaces.map((workspace) => (
                    <View key={workspace.name} style={styles.page}>
                        <WorkspaceContent workspaceName={workspace.name} />
                    </View>
                ))}
            </PagerView>

            {workspaces.length > 1 && (
                <DotIndicator
                    count={workspaces.length}
                    activeIndex={activeIndex}
                    onDotPress={(index) => {
                        pagerRef.current?.setPage(index);
                    }}
                />
            )}
        </View>
    );
};

/**
 * Computes a sliding window of dot indices to display.
 * Keeps the active dot centered when possible, clamped to edges.
 */
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

const DotIndicator: React.FC<{
    count: number;
    activeIndex: number;
    onDotPress: (index: number) => void;
}> = ({ count, activeIndex, onDotPress }) => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const visibleIndices = useMemo(
        () => getVisibleWindow(count, activeIndex),
        [count, activeIndex]
    );

    return (
        <View
            style={[
                styles.dotsContainer,
                { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
            ]}
        >
            <View
                style={[
                    styles.dotsInner,
                    { backgroundColor: ThemedColor.lightened + "CC" },
                ]}
            >
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

const Dot: React.FC<{
    targetSize: number;
    active: boolean;
    onPress: () => void;
}> = React.memo(({ targetSize, active, onPress }) => {
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
        <TouchableOpacity
            onPress={onPress}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            activeOpacity={0.7}
        >
            <Animated.View
                style={[
                    animatedStyle,
                    {
                        backgroundColor: active
                            ? ThemedColor.primary
                            : ThemedColor.tertiary,
                    },
                ]}
            />
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pager: {
        flex: 1,
    },
    page: {
        flex: 1,
    },
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
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
});
