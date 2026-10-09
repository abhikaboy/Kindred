import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import Reanimated, {
    Easing,
    cancelAnimation,
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { hapticSelect } from "@/utils/haptics";

const EASE = Easing.bezier(0.2, 0, 0, 1);
const MAX_LAYERS = 3;
const SWIPE_DISTANCE = 80;
const LIST_GAP = 12;
// Fraction of the spill each later card waits before it starts moving.
const SPILL_STAGGER = 0.06;
const SPILL_MAX_STAGGERED = 10;
export const SPILL_DURATION = 460;
// "Swipe me" nudge: first after 3s idle, then every 10s while the stack is idle.
const NUDGE_DELAY = 3000;
const NUDGE_INTERVAL = 10000;
const NUDGE_DEGREES = 10;

export type StackVariant = "peek" | "fan";
export type SwipeCardStackHandle = { next: () => void; prev: () => void; expand: () => void; collapse: () => void };

type Pose = { y: number; scale: number; rotate: number };
const PEEK = { y: 18, scale: 0.06 };
const FAN = { y: 10, scale: 0.04, rotate: 4 };

const stackHeightFor = (variant: StackVariant, cardHeight: number, layers: number) =>
    cardHeight + (variant === "peek" ? PEEK.y : FAN.y) * Math.max(layers - 1, 0);

// Resting pose of a card `rel` slots behind the front one (rel may be fractional mid-swipe).
function restingPose(variant: StackVariant, rel: number, seq: number): Pose {
    "worklet";
    if (variant === "peek") return { y: -PEEK.y * rel, scale: 1 - PEEK.scale * rel, rotate: 0 };
    const side = seq % 2 === 0 ? 1 : -1;
    return { y: -FAN.y * rel, scale: 1 - FAN.scale * rel, rotate: side * FAN.rotate * Math.min(rel, 1) };
}

type Props<T> = {
    items: T[];
    keyOf: (item: T) => string;
    renderCard: (item: T, front: boolean) => React.ReactNode;
    cardHeight: number;
    variant?: StackVariant;
    /** front surface fades into `backColor` as a card falls behind */
    frontColor: string;
    backColor: string;
    cardStyle?: ViewStyle;
    /** changing this jumps back to the first card */
    resetKey?: string | number;
    onIndexChange?: (index: number) => void;
    /** 0 = stacked, 1 = spilled into a list; lets the parent fade its own content in step */
    spill?: SharedValue<number>;
    onListedChange?: (listed: boolean) => void;
    /** height the spilled list may occupy (from the top of the stack) */
    listHeight?: number;
    /** extra room below the footer, e.g. the device's safe-area bottom inset */
    listBottomPadding?: number;
    listFooter?: React.ReactNode;
};

// Swipeable card stack. Every pose derives from one float `pos` on the UI thread, so a swipe
// commits without a frame where React and the animation disagree.
function SwipeCardStackInner<T>(
    {
        items,
        keyOf,
        renderCard,
        cardHeight,
        variant = "peek",
        frontColor,
        backColor,
        cardStyle,
        resetKey,
        onIndexChange,
        spill,
        onListedChange,
        listHeight = 0,
        listBottomPadding = 24,
        listFooter,
    }: Props<T>,
    ref: React.Ref<SwipeCardStackHandle>
) {
    const { width } = useWindowDimensions();
    const n = items.length;
    const layerCount = Math.min(n, MAX_LAYERS);
    const stackHeight = stackHeightFor(variant, cardHeight, layerCount);

    const [index, setIndex] = useState(0);
    const pos = useSharedValue(0);
    const fly = useSharedValue(-1);
    const dragBase = useSharedValue(0);
    const localSpill = useSharedValue(0);
    const spillValue = spill ?? localSpill;
    const scrollY = useSharedValue(0);
    const [listed, setListed] = useState(false);
    const hint = useSharedValue(0);

    const lastReset = useRef(resetKey);
    useLayoutEffect(() => {
        if (lastReset.current === resetKey) return;
        lastReset.current = resetKey;
        cancelAnimation(pos);
        pos.value = 0;
        setIndex(0);
    }, [resetKey, pos]);

    const current = n ? ((index % n) + n) % n : 0;
    const onIndexChangeRef = useRef(onIndexChange);
    onIndexChangeRef.current = onIndexChange;
    useLayoutEffect(() => {
        onIndexChangeRef.current?.(current);
    }, [current]);

    const commit = useCallback((i: number) => {
        hapticSelect();
        setIndex(i);
    }, []);

    const flyTo = useCallback(
        (target: number, fromT: number) => {
            "worklet";
            pos.value = withTiming(target, { duration: 80 + 180 * (1 - fromT), easing: EASE }, (done) => {
                if (done) runOnJS(commit)(target);
            });
        },
        [pos, commit]
    );

    // Idle hint: a brief rock of the front card, so an untouched stack still reads as swipeable.
    // First fires after NUDGE_DELAY, then repeats every NUDGE_INTERVAL.
    useEffect(() => {
        if (n < 2 || listed) return;
        let interval: ReturnType<typeof setInterval> | null = null;
        const nudge = () => {
            // One direction only: the tilt says "swipe this way", not "wobble"
            hint.value = withSequence(
                withTiming(NUDGE_DEGREES, { duration: 150, easing: EASE }),
                withTiming(0, { duration: 260, easing: EASE })
            );
        };
        const timeout = setTimeout(() => {
            nudge();
            interval = setInterval(nudge, NUDGE_INTERVAL);
        }, NUDGE_DELAY);
        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, [n, listed, hint]);

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .enabled(n > 1 && !listed)
                .activeOffsetX([-12, 12])
                .failOffsetY([-14, 14])
                .onStart(() => {
                    cancelAnimation(hint);
                    hint.value = 0;
                    // A new swipe interrupts one still in flight: finish it instantly.
                    const settled = Math.ceil(pos.value - 0.001);
                    if (settled !== pos.value) {
                        cancelAnimation(pos);
                        pos.value = settled;
                        runOnJS(commit)(settled);
                    }
                    dragBase.value = settled;
                })
                .onUpdate((e) => {
                    const base = dragBase.value;
                    if (e.translationX !== 0) fly.value = e.translationX > 0 ? 1 : -1;
                    pos.value = base + Math.min(Math.abs(e.translationX) / width, 1);
                })
                .onEnd((e) => {
                    const base = dragBase.value;
                    const t = pos.value - base;
                    const passed = Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > 800;
                    if (passed) flyTo(base + 1, t);
                    else pos.value = withTiming(base, { duration: 200, easing: EASE });
                }),
        [n, listed, width, pos, fly, dragBase, hint, commit, flyTo]
    );

    const listScrollRef = useRef<Reanimated.ScrollView>(null);
    const collapse = useCallback(() => {
        const done = () => {
            setListed(false);
            onListedChange?.(false);
        };
        spillValue.value = withTiming(0, { duration: SPILL_DURATION - 80, easing: EASE }, (finished) => {
            if (finished) runOnJS(done)();
        });
    }, [spillValue, onListedChange]);

    useImperativeHandle(
        ref,
        () => ({
            next: () => {
                if (n < 2 || listed) return;
                cancelAnimation(hint);
                hint.value = 0;
                const settled = Math.ceil(pos.value - 0.001);
                cancelAnimation(pos);
                pos.value = settled;
                fly.value = -1;
                flyTo(settled + 1, 0);
            },
            prev: () => {
                if (n < 2 || listed) return;
                cancelAnimation(hint);
                hint.value = 0;
                hapticSelect();
                const settled = Math.ceil(pos.value - 0.001);
                cancelAnimation(pos);
                pos.value = settled;
                fly.value = 1;
                const target = settled - 1;
                setIndex(target);
                pos.value = withTiming(target, { duration: 220, easing: EASE });
            },
            expand: () => {
                if (!n) return;
                scrollY.value = 0;
                setListed(true);
                onListedChange?.(true);
                spillValue.value = withTiming(1, { duration: SPILL_DURATION, easing: EASE });
            },
            collapse,
        }),
        [n, listed, pos, fly, hint, flyTo, scrollY, spillValue, collapse]
    );

    const onListScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });

    if (!n) return null;

    if (listed) {
        const ordered = items.map((_, i) => items[(current + i) % n]);
        const contentHeight = n * (cardHeight + LIST_GAP);
        return (
            <View style={{ width: "100%", height: Math.max(listHeight, stackHeight) }}>
                <Reanimated.ScrollView
                    ref={listScrollRef}
                    onScroll={onListScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    style={StyleSheet.absoluteFill}
                    contentContainerStyle={{ paddingBottom: listBottomPadding }}>
                    {/* Empty space around the cards taps back to the stack; cards and footer keep their own taps */}
                    <Pressable
                        onPress={collapse}
                        accessibilityLabel="Collapse list"
                        style={{ minHeight: Math.max(listHeight, stackHeight) }}>
                        <View style={{ height: contentHeight }}>
                            {ordered.map((item, i) => (
                                <SpilledCard
                                    key={keyOf(item)}
                                    i={i}
                                    count={n}
                                    variant={variant}
                                    cardHeight={cardHeight}
                                    stackHeight={stackHeight}
                                    layerCount={layerCount}
                                    seq={index + i}
                                    spill={spillValue}
                                    scrollY={scrollY}
                                    frontColor={frontColor}
                                    backColor={backColor}
                                    style={cardStyle}>
                                    {renderCard(item, true)}
                                </SpilledCard>
                            ))}
                        </View>
                        {listFooter && <SpillFade spill={spillValue}>{listFooter}</SpillFade>}
                    </Pressable>
                </Reanimated.ScrollView>
            </View>
        );
    }

    const layers: { item: T; depth: number }[] = [];
    for (let depth = 0; depth < layerCount; depth++) layers.push({ item: items[(current + depth) % n], depth });

    return (
        <GestureDetector gesture={pan}>
            <View style={{ height: stackHeight, width: "100%" }}>
                {layers
                    .slice()
                    .reverse()
                    .map(({ item, depth }) => (
                        <StackedCard
                            key={keyOf(item)}
                            seq={index + depth}
                            depth={depth}
                            layerCount={layerCount}
                            variant={variant}
                            pos={pos}
                            fly={fly}
                            width={width}
                            cardHeight={cardHeight}
                            frontColor={frontColor}
                            backColor={backColor}
                            hint={depth === 0 ? hint : undefined}
                            style={cardStyle}>
                            {renderCard(item, depth === 0)}
                        </StackedCard>
                    ))}
            </View>
        </GestureDetector>
    );
}

export const SwipeCardStack = forwardRef(SwipeCardStackInner) as <T>(
    props: Props<T> & { ref?: React.Ref<SwipeCardStackHandle> }
) => React.ReactElement | null;

function StackedCard({
    seq,
    depth,
    layerCount,
    variant,
    pos,
    fly,
    width,
    cardHeight,
    frontColor,
    backColor,
    hint,
    style,
    children,
}: {
    seq: number;
    depth: number;
    layerCount: number;
    variant: StackVariant;
    pos: SharedValue<number>;
    fly: SharedValue<number>;
    width: number;
    cardHeight: number;
    frontColor: string;
    backColor: string;
    /** idle "swipe me" rotation, applied to the front card only */
    hint?: SharedValue<number>;
    style?: ViewStyle;
    children: React.ReactNode;
}) {
    // A card that wraps from the front to the back fades in there instead of popping.
    const appear = useSharedValue(1);
    const lastSeq = useRef(seq);
    useLayoutEffect(() => {
        if (seq - lastSeq.current > 1) {
            appear.value = 0;
            appear.value = withTiming(1, { duration: 240, easing: EASE });
        }
        lastSeq.current = seq;
    }, [seq, appear]);

    const animated = useAnimatedStyle(() => {
        const rel = seq - pos.value;
        if (rel < 0) {
            const t = Math.min(-rel, 1);
            return {
                opacity: 1,
                backgroundColor: frontColor,
                transform: [
                    { translateX: fly.value * t * width * 1.15 },
                    { rotateZ: `${fly.value * t * 12}deg` },
                ] as any,
            };
        }
        const pose = restingPose(variant, Math.min(rel, layerCount - 1), seq);
        // The card at the very back fades out as it would drop below the visible layers
        const tail = interpolate(rel, [layerCount - 1, layerCount], [1, 0], "clamp");
        return {
            opacity: tail * appear.value,
            backgroundColor: interpolateColor(Math.min(rel, 1), [0, 1], [frontColor, backColor]),
            transform: [
                { translateY: pose.y },
                { scale: pose.scale },
                { rotateZ: `${pose.rotate + (hint?.value ?? 0)}deg` },
            ] as any,
        };
    });

    return (
        <Reanimated.View
            pointerEvents={depth === 0 ? "auto" : "none"}
            style={[styles.card, { height: cardHeight, bottom: 0, zIndex: 10 - depth }, styles.stacked, style, animated]}>
            {children}
        </Reanimated.View>
    );
}

function SpilledCard({
    i,
    count,
    variant,
    cardHeight,
    stackHeight,
    layerCount,
    seq,
    spill,
    scrollY,
    frontColor,
    backColor,
    style,
    children,
}: {
    i: number;
    count: number;
    variant: StackVariant;
    cardHeight: number;
    stackHeight: number;
    layerCount: number;
    seq: number;
    spill: SharedValue<number>;
    scrollY: SharedValue<number>;
    frontColor: string;
    backColor: string;
    style?: ViewStyle;
    children: React.ReactNode;
}) {
    const listTop = i * (cardHeight + LIST_GAP);
    const animated = useAnimatedStyle(() => {
        const staggered = Math.min(count, SPILL_MAX_STAGGERED) - 1;
        const t = Math.min(Math.max(spill.value * (1 + SPILL_STAGGER * staggered) - SPILL_STAGGER * Math.min(i, staggered), 0), 1);
        const rel = Math.min(i, layerCount - 1);
        const pose = restingPose(variant, rel, seq);
        // Where this card sits in the stack, in list coordinates (stack cards are bottom-aligned)
        const stackTop = stackHeight - cardHeight + pose.y + scrollY.value;
        const hidden = i >= layerCount;
        return {
            opacity: hidden ? t : 1,
            backgroundColor: interpolateColor(Math.max(Math.min(rel, 1) - t, 0), [0, 1], [frontColor, backColor]),
            transform: [
                { translateY: (stackTop - listTop) * (1 - t) },
                { scale: pose.scale + (1 - pose.scale) * t },
                { rotateZ: `${pose.rotate * (1 - t)}deg` },
            ] as any,
        };
    });
    return (
        <Reanimated.View
            style={[styles.card, { height: cardHeight, top: listTop, zIndex: count - i }, styles.stacked, style, animated]}>
            {children}
        </Reanimated.View>
    );
}

function SpillFade({ spill, children }: { spill: SharedValue<number>; children: React.ReactNode }) {
    const animated = useAnimatedStyle(() => ({ opacity: interpolate(spill.value, [0.6, 1], [0, 1], "clamp") }));
    return <Reanimated.View style={animated}>{children}</Reanimated.View>;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 4,
    },
    stacked: { position: "absolute", left: 0, right: 0 },
});
