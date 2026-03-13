import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

const SPRING_CONFIG = {
    damping: 20,
    stiffness: 200,
    mass: 0.5,
};

type AnimatedTabBarProps = {
    tabs: string[];
    activeTab: number;
    setActiveTab: (index: number) => void;
};

export default function AnimatedTabs({ tabs, activeTab, setActiveTab }: AnimatedTabBarProps) {
    const ThemedColor = useThemeColor();
    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);
    const tabLayouts = useRef<Record<number, { x: number; width: number }>>({});
    const initialized = useRef(false);

    const handleTabLayout = useCallback(
        (index: number, event: LayoutChangeEvent) => {
            const { x, width } = event.nativeEvent.layout;
            tabLayouts.current[index] = { x, width };

            if (index === activeTab && !initialized.current) {
                indicatorX.value = x;
                indicatorWidth.value = width;
                initialized.current = true;
            }
        },
        [activeTab, indicatorX, indicatorWidth],
    );

    useEffect(() => {
        const layout = tabLayouts.current[activeTab];
        if (layout && initialized.current) {
            indicatorX.value = withSpring(layout.x, SPRING_CONFIG);
            indicatorWidth.value = withSpring(layout.width, SPRING_CONFIG);
        }
    }, [activeTab, indicatorX, indicatorWidth]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorX.value }],
        width: indicatorWidth.value,
    }));

    return (
        <View style={[styles.tabBar, { borderBottomColor: ThemedColor.tertiary }]}>
            {tabs.map((tab, index) => (
                <Pressable
                    key={`tab-${index}-${tab}`}
                    style={styles.tab}
                    onLayout={(e) => handleTabLayout(index, e)}
                    onPress={() => setActiveTab(index)}>
                    <ThemedText
                        style={[
                            styles.tabText,
                            {
                                color: activeTab === index ? ThemedColor.text : ThemedColor.caption,
                                fontWeight: activeTab === index ? "600" : "500",
                            },
                        ]}>
                        {tab}
                    </ThemedText>
                </Pressable>
            ))}
            <Animated.View
                style={[styles.indicator, { backgroundColor: ThemedColor.primary }, indicatorStyle]}
            />
        </View>
    );
}

type AnimatedTabContentProps = {
    activeTab: number;
    setActiveTab?: (index: number) => void;
    children: React.ReactNode[];
    flex?: boolean;
};

const SWIPE_VELOCITY_THRESHOLD = 500;
const SWIPE_DISTANCE_FRACTION = 0.3;

export function AnimatedTabContent({ activeTab, setActiveTab, children, flex }: AnimatedTabContentProps) {
    const [layoutWidth, setLayoutWidth] = useState(0);
    const translateX = useSharedValue(0);
    const tabCount = React.Children.count(children);

    const activeTabSV = useSharedValue(activeTab);
    const widthSV = useSharedValue(0);

    activeTabSV.value = activeTab;

    useEffect(() => {
        if (layoutWidth > 0) {
            widthSV.value = layoutWidth;
            translateX.value = withSpring(-activeTab * layoutWidth, SPRING_CONFIG);
        }
    }, [activeTab, layoutWidth, translateX, widthSV]);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
            "worklet";
            const w = widthSV.value;
            const base = -activeTabSV.value * w;
            const maxRight = -(tabCount - 1) * w;
            const raw = base + e.translationX;
            translateX.value = Math.max(maxRight, Math.min(0, raw));
        })
        .onEnd((e) => {
            "worklet";
            const w = widthSV.value;
            const current = activeTabSV.value;

            if (!setActiveTab) {
                translateX.value = withSpring(-current * w, SPRING_CONFIG);
                return;
            }

            const swipedLeft = e.velocityX < -SWIPE_VELOCITY_THRESHOLD || e.translationX < -w * SWIPE_DISTANCE_FRACTION;
            const swipedRight = e.velocityX > SWIPE_VELOCITY_THRESHOLD || e.translationX > w * SWIPE_DISTANCE_FRACTION;

            let nextTab = current;
            if (swipedLeft && nextTab < tabCount - 1) {
                nextTab = nextTab + 1;
            } else if (swipedRight && nextTab > 0) {
                nextTab = nextTab - 1;
            }

            translateX.value = withSpring(-nextTab * w, SPRING_CONFIG);
            if (nextTab !== current) {
                activeTabSV.value = nextTab;
                runOnJS(setActiveTab)(nextTab);
            }
        });

    const slidingStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const fillStyle = flex ? { flex: 1 } : undefined;

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        setLayoutWidth(w);
        widthSV.value = w;
    }, [widthSV]);

    return (
        <GestureDetector gesture={panGesture}>
            <View style={[styles.contentClip, fillStyle]} onLayout={handleLayout}>
                {layoutWidth > 0 && (
                    <Animated.View style={[styles.contentRow, fillStyle, slidingStyle]}>
                        {React.Children.map(children, (child) => (
                            <View style={{ width: layoutWidth }}>{child}</View>
                        ))}
                    </Animated.View>
                )}
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: "row",
        borderBottomWidth: 1,
        position: "relative",
    },
    tab: {
        flex: 1,
        paddingBottom: 12,
        paddingTop: 4,
        alignItems: "center",
    },
    tabText: {
        fontSize: 16,
        fontFamily: "Outfit",
        textAlign: "center",
    },
    indicator: {
        position: "absolute",
        bottom: -1,
        height: 2.5,
        borderRadius: 2,
    },
    contentClip: {
        overflow: "hidden",
    },
    contentRow: {
        flexDirection: "row",
    },
});
