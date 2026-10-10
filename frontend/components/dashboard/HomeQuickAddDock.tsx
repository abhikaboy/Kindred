import React, { useCallback, type RefObject } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Mask, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import QuickCapture from "@/components/dashboard/QuickCapture";
import { ACTIVE_BAR_SPACE } from "@/components/dashboard/ActiveTaskMiniBar";
import { useActiveTask } from "@/hooks/useActiveTask";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useFocusMode } from "@/contexts/focusModeContext";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { isOnboardingV2Active } from "@/utils/onboardingV2/active";

// Floating tab bar height (matches PagerDots).
const TAB_BAR_HEIGHT = 83;
export const HOME_DOCK_SPACE = TAB_BAR_HEIGHT + 96;

// Desktop-style quick add docked above the tab bar, over a dotted purple glow.
export default function HomeQuickAddDock({
    sectionRef,
    onSubmitted,
    anchorRef,
    onLayout,
}: {
    sectionRef?: (node: View | null) => void;
    onSubmitted?: () => void;
    /** Dock view ref for the onboarding coach. */
    anchorRef?: RefObject<View | null>;
    onLayout?: () => void;
}) {
    const ThemedColor = useThemeColor();
    const setDockNode = useCallback(
        (node: View | null) => {
            sectionRef?.(node);
            if (anchorRef) anchorRef.current = node;
        },
        [sectionRef, anchorRef]
    );
    const insets = useSafeAreaInsets();
    // Focus mode hides the tab bar, so the dock drops to the bottom edge
    const { focusMode } = useFocusMode();
    // The tab bar is also hidden during onboarding v2
    const { step, isLoading } = useOnboardingV2Context();
    const hasActiveTask = !!useActiveTask();
    const tabBarHidden = focusMode || isOnboardingV2Active(step, isLoading);
    return (
        <View ref={setDockNode} onLayout={onLayout} testID="home-quick-add" collapsable={false} pointerEvents="box-none" style={[styles.dock, { bottom: insets.bottom + (tabBarHidden ? 8 : TAB_BAR_HEIGHT + 4) + (hasActiveTask ? ACTIVE_BAR_SPACE : 0) }]}>
            <View pointerEvents="none" style={styles.glow}>
                <Svg width="100%" height="100%">
                    <Defs>
                        <Pattern id="dots" width={10} height={10} patternUnits="userSpaceOnUse">
                            <Circle cx={5} cy={5} r={1.3} fill={ThemedColor.primary} />
                        </Pattern>
                        <RadialGradient id="fade" cx="50%" cy="60%" rx="50%" ry="50%">
                            <Stop offset="0" stopColor="#fff" stopOpacity={0.55} />
                            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
                        </RadialGradient>
                        <Mask id="m">
                            <Rect width="100%" height="100%" fill="url(#fade)" />
                        </Mask>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#dots)" mask="url(#m)" />
                </Svg>
            </View>
            <QuickCapture variant="pill" placeholder="Add a task, like gym @7am tomorrow" onSubmitted={onSubmitted} />
        </View>
    );
}

const styles = StyleSheet.create({
    dock: { position: "absolute", left: HORIZONTAL_PADDING, right: HORIZONTAL_PADDING },
    glow: { position: "absolute", left: -HORIZONTAL_PADDING, right: -HORIZONTAL_PADDING, top: -56, bottom: -24 },
});
