# Productivity Rings Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the profile page ProductivityRings into a card with an SVG arc gauge for the score, blur-overlay expand behavior with 7-day history and contextual CTAs, and remove rings from the dashboard.

**Architecture:** Four new focused components (`ScoreArc`, `ExpandedRingDetail`, `RingsBlurOverlay`, rewritten `ProductivityRingsCard`) composed together on the profile page. Blur overlay is rendered at the profile ScrollView level and controlled via callback prop. All data comes from the existing `useRings` hook — no backend changes.

**Tech Stack:** React Native, react-native-svg (existing), expo-blur (existing), Animated API, LayoutAnimation

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/components/profile/ScoreArc.tsx` | Create | Pure SVG semi-circle gauge |
| `frontend/components/profile/ExpandedRingDetail.tsx` | Create | History dots, guidance text, CTAs |
| `frontend/components/profile/RingsBlurOverlay.tsx` | Create | Full-screen BlurView overlay |
| `frontend/components/profile/ProductivityRings.tsx` | Rewrite | Card wrapper composing arc + rings + expand |
| `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx` | Modify | Add blur overlay, pass expand callback |
| `frontend/components/dashboard/HomescrollContent.tsx` | Modify | Remove rings import and usage |

---

### Task 1: Create ScoreArc Component

**Files:**
- Create: `frontend/components/profile/ScoreArc.tsx`

- [ ] **Step 1: Create the ScoreArc SVG component**

Create `frontend/components/profile/ScoreArc.tsx`:

```tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

const ARC_WIDTH = 200;
const ARC_HEIGHT = 120;
const STROKE_WIDTH = 10;
const PRIMARY_COLOR = "#854DFF";

// Semi-circle arc from left to right (180 degrees)
const RADIUS = (ARC_WIDTH - STROKE_WIDTH) / 2;
const CENTER_X = ARC_WIDTH / 2;
const CENTER_Y = ARC_HEIGHT - 10; // bottom-aligned with padding

function describeArc(startAngle: number, endAngle: number): string {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const startX = CENTER_X + RADIUS * Math.cos(startRad);
    const startY = CENTER_Y - RADIUS * Math.sin(startRad);
    const endX = CENTER_X + RADIUS * Math.cos(endRad);
    const endY = CENTER_Y - RADIUS * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${endX} ${endY}`;
}

interface ScoreArcProps {
    score: number;
    maxScore?: number;
}

const ScoreArc: React.FC<ScoreArcProps> = ({ score, maxScore = 100 }) => {
    const ThemedColor = useThemeColor();
    const fraction = Math.min(Math.max(score / maxScore, 0), 1);

    // Track goes from 180 degrees (left) to 0 degrees (right)
    const trackPath = describeArc(0, 180);
    // Fill arc: proportional sweep from left
    const fillEndAngle = 180 - fraction * 180;
    const fillPath = fraction > 0 ? describeArc(fillEndAngle, 180) : "";

    const displayScore = score >= 30 ? score : "--";

    return (
        <View style={styles.container}>
            <Svg width={ARC_WIDTH} height={ARC_HEIGHT}>
                {/* Background track */}
                <Path
                    d={trackPath}
                    stroke={ThemedColor.tertiary}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeLinecap="round"
                />
                {/* Score fill */}
                {fillPath !== "" && (
                    <Path
                        d={fillPath}
                        stroke={PRIMARY_COLOR}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                    />
                )}
            </Svg>
            {/* Score number centered in arc */}
            <View style={styles.scoreOverlay}>
                <ThemedText style={[styles.scoreValue, { color: ThemedColor.text }]}>
                    {displayScore}
                </ThemedText>
            </View>
            {/* Min/max labels */}
            <View style={styles.labelsRow}>
                <ThemedText style={[styles.label, { color: ThemedColor.caption }]}>
                    0
                </ThemedText>
                <ThemedText style={[styles.label, { color: ThemedColor.caption }]}>
                    100
                </ThemedText>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        width: ARC_WIDTH,
        height: ARC_HEIGHT + 16,
    },
    scoreOverlay: {
        position: "absolute",
        bottom: 20,
        alignItems: "center",
    },
    scoreValue: {
        fontSize: 36,
        fontWeight: "600",
        fontFamily: "Fraunces",
    },
    labelsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: ARC_WIDTH - STROKE_WIDTH,
        marginTop: -6,
    },
    label: {
        fontSize: 11,
        fontFamily: "Outfit",
    },
});

export default ScoreArc;
```

- [ ] **Step 2: Verify the component renders**

Start the dev server if not running (`bun expo start`), then manually import and render `<ScoreArc score={72} />` temporarily in `profile.tsx` to verify the arc renders correctly. Remove the temporary import after verification.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ScoreArc.tsx
git commit -m "feat(profile): add ScoreArc SVG semi-circle gauge component"
```

---

### Task 2: Create ExpandedRingDetail Component

**Files:**
- Create: `frontend/components/profile/ExpandedRingDetail.tsx`

- [ ] **Step 1: Create the ExpandedRingDetail component**

Create `frontend/components/profile/ExpandedRingDetail.tsx`:

```tsx
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { RingState } from "@/api/types";

type RingKey = "plan" | "do" | "share";

const PRIMARY_COLOR = "#854DFF";

const RING_LABELS: Record<RingKey, string> = {
    plan: "Plan",
    do: "Do",
    share: "Share",
};

const RING_GUIDANCE: Record<RingKey, string> = {
    plan: "Create or schedule tasks to close this ring",
    do: "Complete tasks to close this ring",
    share: "Post an update or send kudos to close this ring",
};

interface CTA {
    label: string;
    route: string;
}

const RING_CTAS: Record<RingKey, CTA[]> = {
    plan: [
        { label: "Plan Today", route: "/(logged-in)/(tabs)/(task)/daily" },
        { label: "Quick Add", route: "/(logged-in)/(tabs)/(task)/voice" },
    ],
    do: [
        { label: "View Tasks", route: "/(logged-in)/(tabs)/(task)/today" },
    ],
    share: [
        { label: "Make a Post", route: "/(logged-in)/posting/cameraview" },
        { label: "Send Kudos", route: "/(logged-in)/kudos-rewards" },
    ],
};

// Day labels starting from Monday
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface ExpandedRingDetailProps {
    ringKey: RingKey;
    todayRing: { current: number; target: number; closed: boolean };
    history: RingState[];
}

/**
 * Build a 7-day array of closed/not-closed for a specific ring,
 * ordered from 6 days ago to today.
 */
function buildHistoryDots(
    history: RingState[],
    ringKey: RingKey
): { dayLabel: string; closed: boolean }[] {
    const today = new Date();
    const dots: { dayLabel: string; closed: boolean }[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayIndex = (date.getDay() + 6) % 7; // Monday=0
        const dateStr = date.toISOString().split("T")[0];

        const state = history.find((h) => {
            const hDate = new Date(h.date).toISOString().split("T")[0];
            return hDate === dateStr;
        });

        dots.push({
            dayLabel: DAY_LABELS[dayIndex],
            closed: state ? state[ringKey].closed : false,
        });
    }

    return dots;
}

const ExpandedRingDetail: React.FC<ExpandedRingDetailProps> = ({
    ringKey,
    todayRing,
    history,
}) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const dots = buildHistoryDots(history, ringKey);
    const ctas = RING_CTAS[ringKey];

    return (
        <View style={styles.container}>
            {/* Ring header */}
            <ThemedText style={[styles.header, { color: ThemedColor.text }]}>
                {RING_LABELS[ringKey]} — {todayRing.current} / {todayRing.target}
            </ThemedText>

            {/* Guidance text */}
            <ThemedText
                style={[
                    styles.guidance,
                    todayRing.closed
                        ? { color: ThemedColor.success }
                        : { color: ThemedColor.caption },
                ]}
            >
                {todayRing.closed ? "Closed!" : RING_GUIDANCE[ringKey]}
            </ThemedText>

            {/* 7-day history dots */}
            <View style={styles.dotsRow}>
                {dots.map((dot, idx) => (
                    <View key={idx} style={styles.dotColumn}>
                        <View
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: dot.closed
                                        ? PRIMARY_COLOR
                                        : ThemedColor.tertiary,
                                },
                            ]}
                        />
                        <ThemedText
                            style={[styles.dotLabel, { color: ThemedColor.caption }]}
                        >
                            {dot.dayLabel}
                        </ThemedText>
                    </View>
                ))}
            </View>

            {/* CTAs */}
            <View style={styles.ctaRow}>
                {ctas.map((cta) => (
                    <TouchableOpacity
                        key={cta.label}
                        style={styles.ctaButton}
                        onPress={() => router.push(cta.route as any)}
                        activeOpacity={0.7}
                    >
                        <ThemedText style={styles.ctaText}>{cta.label}</ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(128, 128, 128, 0.2)",
    },
    header: {
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "Outfit",
    },
    guidance: {
        fontSize: 13,
        fontFamily: "Outfit",
    },
    dotsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 8,
    },
    dotColumn: {
        alignItems: "center",
        gap: 4,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    dotLabel: {
        fontSize: 10,
        fontFamily: "Outfit",
    },
    ctaRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    ctaButton: {
        backgroundColor: PRIMARY_COLOR,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    ctaText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
});

export default ExpandedRingDetail;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/profile/ExpandedRingDetail.tsx
git commit -m "feat(profile): add ExpandedRingDetail with history dots and CTAs"
```

---

### Task 3: Create RingsBlurOverlay Component

**Files:**
- Create: `frontend/components/profile/RingsBlurOverlay.tsx`

- [ ] **Step 1: Create the RingsBlurOverlay component**

This follows the exact same pattern as `FABBackdrop.tsx`.

Create `frontend/components/profile/RingsBlurOverlay.tsx`:

```tsx
import React, { useEffect, useRef } from "react";
import { TouchableWithoutFeedback, Animated, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

interface RingsBlurOverlayProps {
    visible: boolean;
    onDismiss: () => void;
}

const RingsBlurOverlay: React.FC<RingsBlurOverlayProps> = ({ visible, onDismiss }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    if (!visible) return null;

    return (
        <TouchableWithoutFeedback onPress={onDismiss}>
            <Animated.View style={[styles.overlay, { opacity }]}>
                <BlurView intensity={15} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 998,
    },
});

export default RingsBlurOverlay;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/profile/RingsBlurOverlay.tsx
git commit -m "feat(profile): add RingsBlurOverlay with expo-blur backdrop"
```

---

### Task 4: Rewrite ProductivityRings into ProductivityRingsCard

**Files:**
- Rewrite: `frontend/components/profile/ProductivityRings.tsx`

- [ ] **Step 1: Rewrite ProductivityRings.tsx**

Replace the entire contents of `frontend/components/profile/ProductivityRings.tsx` with:

```tsx
import React, { useState, useCallback } from "react";
import {
    View,
    StyleSheet,
    LayoutAnimation,
    UIManager,
    Platform,
    TouchableOpacity,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRings } from "@/hooks/useRings";
import { RingProgress } from "@/api/types";
import ScoreArc from "./ScoreArc";
import ExpandedRingDetail from "./ExpandedRingDetail";

if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RING_SIZE = 80;
const STROKE_WIDTH = 6;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PRIMARY_COLOR = "#854DFF";

type RingKey = "plan" | "do" | "share";

function RingCircle({
    progress,
    trackColor,
}: {
    progress: RingProgress;
    trackColor: string;
}) {
    const fraction =
        progress.target > 0
            ? Math.min(progress.current / progress.target, 1)
            : 0;
    const strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

    return (
        <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={trackColor}
                strokeWidth={STROKE_WIDTH}
                fill="none"
            />
            <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={PRIMARY_COLOR}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
        </Svg>
    );
}

/**
 * Count total closed rings across the 7-day history window.
 */
function countClosedRings(
    history: { plan: { closed: boolean }; do: { closed: boolean }; share: { closed: boolean } }[]
): number {
    let count = 0;
    for (const state of history) {
        if (state.plan.closed) count++;
        if (state.do.closed) count++;
        if (state.share.closed) count++;
    }
    return count;
}

interface ProductivityRingsCardProps {
    expanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
}

const ProductivityRingsCard: React.FC<ProductivityRingsCardProps> = ({
    expanded,
    onExpandChange,
}) => {
    const ThemedColor = useThemeColor();
    const { rings, score, isLoading, history } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);

    // Sync with parent: when blur overlay is dismissed, clear internal state
    React.useEffect(() => {
        if (expanded === false && expandedRing !== null) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedRing(null);
        }
    }, [expanded]);

    const trackColor = ThemedColor.tertiary;
    const closedRings = countClosedRings(history);

    // Count streak from useRings — todayData has current_streak but useRings
    // doesn't expose it yet. We'll derive it from history for now:
    // consecutive days from today where all_closed is true.
    let streak = 0;
    const sortedHistory = [...history].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const state of sortedHistory) {
        if (state.all_closed) {
            streak++;
        } else {
            break;
        }
    }

    const handleRingPress = useCallback(
        (key: RingKey) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const newExpanded = expandedRing === key ? null : key;
            setExpandedRing(newExpanded);
            onExpandChange?.(newExpanded !== null);
        },
        [expandedRing, onExpandChange]
    );

    const handleDismiss = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedRing(null);
        onExpandChange?.(false);
    }, [onExpandChange]);

    if (isLoading || !rings) {
        return null;
    }

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: rings.plan },
        { key: "do", label: "Do", progress: rings.do },
        { key: "share", label: "Share", progress: rings.share },
    ];

    const isExpanded = expandedRing !== null;

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: ThemedColor.lightened,
                },
                isExpanded && styles.cardExpanded,
            ]}
        >
            {/* Score Arc */}
            <View style={styles.arcSection}>
                <ScoreArc score={score} />
                {/* Stat pills */}
                <View style={styles.pillsRow}>
                    <View style={[styles.pill, { backgroundColor: ThemedColor.tertiary }]}>
                        <ThemedText style={[styles.pillText, { color: ThemedColor.text }]}>
                            Rings: {closedRings}/21
                        </ThemedText>
                    </View>
                    <View style={[styles.pill, { backgroundColor: ThemedColor.tertiary }]}>
                        <ThemedText style={[styles.pillText, { color: ThemedColor.text }]}>
                            Streak: {streak} days
                        </ThemedText>
                    </View>
                </View>
            </View>

            {/* Rings Row */}
            <View style={styles.ringsRow}>
                {ringEntries.map(({ key, label, progress }) => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.ringItem,
                            isExpanded &&
                                expandedRing !== key && { opacity: 0.3 },
                        ]}
                        onPress={() => handleRingPress(key)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.ringWrapper}>
                            <RingCircle
                                progress={progress}
                                trackColor={trackColor}
                            />
                            <View style={styles.ringCenter}>
                                {progress.closed ? (
                                    <Check
                                        size={24}
                                        color={PRIMARY_COLOR}
                                        weight="bold"
                                    />
                                ) : (
                                    <ThemedText
                                        style={[
                                            styles.ringText,
                                            { color: ThemedColor.text },
                                        ]}
                                    >
                                        {progress.current}/{progress.target}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                        <ThemedText
                            style={[
                                styles.ringLabel,
                                { color: ThemedColor.caption },
                            ]}
                        >
                            {label.toUpperCase()}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Expanded detail */}
            {expandedRing && (
                <ExpandedRingDetail
                    ringKey={expandedRing}
                    todayRing={rings[expandedRing]}
                    history={history}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 20,
        gap: 20,
        // Shadow
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 3,
    },
    cardExpanded: {
        transform: [{ scale: 1.03 }],
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
        zIndex: 999,
    },
    arcSection: {
        alignItems: "center",
        gap: 8,
    },
    pillsRow: {
        flexDirection: "row",
        gap: 10,
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pillText: {
        fontSize: 12,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
    ringsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    ringItem: {
        alignItems: "center",
        gap: 6,
    },
    ringWrapper: {
        width: 80,
        height: 80,
        justifyContent: "center",
        alignItems: "center",
    },
    ringCenter: {
        position: "absolute",
        justifyContent: "center",
        alignItems: "center",
    },
    ringText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    ringLabel: {
        fontSize: 11,
        fontFamily: "Outfit",
        letterSpacing: 1,
    },
});

export { ProductivityRingsCard };
export default ProductivityRingsCard;
```

- [ ] **Step 2: Verify the card renders on the profile page**

The profile page already imports `ProductivityRings` as the default export from this file, so it should pick up the new card automatically. Open the profile page in the app and verify:
- Arc gauge renders with the score
- Three rings show below the arc
- Stat pills show beneath the arc
- Card has visible rounded corners and shadow

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ProductivityRings.tsx
git commit -m "feat(profile): rewrite ProductivityRings as card with arc gauge and expand"
```

---

### Task 5: Wire Blur Overlay into Profile Page

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx`

- [ ] **Step 1: Add blur overlay state and import**

In `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx`, add the import for `RingsBlurOverlay` and a state variable for the expand callback:

Add to the imports at the top of the file (after the existing `ProductivityRings` import):

```tsx
import RingsBlurOverlay from "@/components/profile/RingsBlurOverlay";
```

Inside the `Profile` component, add state:

```tsx
const [ringsExpanded, setRingsExpanded] = useState(false);
```

(Also add `useState` to the React import if not already destructured — it is already imported.)

- [ ] **Step 2: Render the blur overlay and pass callback to ProductivityRings**

In the JSX return, add `RingsBlurOverlay` just inside the `Animated.ScrollView`, before `ParallaxBanner`:

```tsx
<RingsBlurOverlay
    visible={ringsExpanded}
    onDismiss={() => setRingsExpanded(false)}
/>
```

Update the `ProductivityRings` usage (around line 112) to pass the callback:

Change:
```tsx
<ProductivityRings userId={user?._id} />
```

To:
```tsx
<ProductivityRings expanded={ringsExpanded} onExpandChange={setRingsExpanded} />
```

(The `userId` prop is no longer used — the rewritten component gets data from `useRings` directly. The `expanded` prop syncs the blur overlay dismiss back to the card's internal state.)

- [ ] **Step 3: Verify blur behavior**

Open the profile page, tap a ring circle. Verify:
- BlurView overlay appears behind the card with fade-in
- Tapping the blur overlay dismisses the expanded ring
- Card scales up slightly when expanded
- Non-selected rings dim to 0.3 opacity
- Expanded detail shows history dots, guidance text, and CTAs
- CTA buttons navigate to the correct screens

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(logged-in\)/\(tabs\)/\(profile\)/profile.tsx
git commit -m "feat(profile): wire RingsBlurOverlay into profile page"
```

---

### Task 6: Expose streak from useRings hook

**Files:**
- Modify: `frontend/hooks/useRings.ts`

- [ ] **Step 1: Expose current_streak from the API response**

The backend returns `current_streak` in the today response, but `useRings` doesn't expose it. Add it so the card can use the authoritative value instead of deriving from history.

In `frontend/hooks/useRings.ts`, update the derived state section:

Change:
```ts
    // Derived state
    const rings: RingState | null = todayData?.ring_state ?? null;
    const score = todayData?.productivity_score ?? 0;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = todayData?.reward_available ?? false;
```

To:
```ts
    // Derived state
    const rings: RingState | null = todayData?.ring_state ?? null;
    const score = todayData?.productivity_score ?? 0;
    const streak = todayData?.current_streak ?? 0;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = todayData?.reward_available ?? false;
```

Update the return object — change:
```ts
    return {
        rings,
        score,
        allClosed,
        canClaimReward,
        isLoading: isLoadingToday,
        history: historyData?.history ?? [],
        claimReward: claimRewardMutation.mutateAsync,
        isClaiming: claimRewardMutation.isPending,
        refetch,
    };
```

To:
```ts
    return {
        rings,
        score,
        streak,
        allClosed,
        canClaimReward,
        isLoading: isLoadingToday,
        history: historyData?.history ?? [],
        claimReward: claimRewardMutation.mutateAsync,
        isClaiming: claimRewardMutation.isPending,
        refetch,
    };
```

- [ ] **Step 2: Use streak from hook in ProductivityRingsCard**

In `frontend/components/profile/ProductivityRings.tsx`, update the hook destructure:

Change:
```ts
const { rings, score, isLoading, history } = useRings();
```

To:
```ts
const { rings, score, streak, isLoading, history } = useRings();
```

Then remove the streak derivation block (the `let streak = 0; const sortedHistory = ...` block and the `for` loop) and use `streak` directly from the hook.

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useRings.ts frontend/components/profile/ProductivityRings.tsx
git commit -m "feat(profile): expose streak from useRings hook, remove local derivation"
```

---

### Task 7: Remove Rings from Dashboard

**Files:**
- Modify: `frontend/components/dashboard/HomescrollContent.tsx`

- [ ] **Step 1: Remove ProductivityRings import and usage**

In `frontend/components/dashboard/HomescrollContent.tsx`:

Remove the import line (line 14):
```tsx
import ProductivityRings from "@/components/profile/ProductivityRings";
```

Remove the rings section (lines 316-319):
```tsx
                {/* Productivity Rings */}
                <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 8 }}>
                    <ProductivityRings compact />
                </View>
```

- [ ] **Step 2: Verify dashboard still renders correctly**

Open the dashboard home screen. Verify:
- No rings visible
- DashboardStats and other cards render normally
- No console errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/HomescrollContent.tsx
git commit -m "chore(dashboard): remove ProductivityRings from home screen"
```

---

### Task 8: Clean Up Unused Props

**Files:**
- Modify: `frontend/components/profile/ProductivityRings.tsx`

- [ ] **Step 1: Remove the compact prop**

The rewritten `ProductivityRingsCard` no longer accepts or uses a `compact` prop (the dashboard was the only consumer). Verify the interface only has `expanded` and `onExpandChange`:

```tsx
interface ProductivityRingsCardProps {
    expanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
}
```

If there is still a `compact` or `userId` prop in the interface, remove it.

- [ ] **Step 2: Final visual check**

Open the profile page and verify the full flow:
1. Card renders with arc gauge, stat pills, and three rings
2. Tapping a ring: blur overlay appears, card lifts, detail expands with history dots + CTAs
3. Tapping blur: dismisses back to collapsed state
4. CTA buttons navigate correctly
5. Dashboard no longer shows rings

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ProductivityRings.tsx
git commit -m "chore(profile): clean up unused compact/userId props from rings card"
```
