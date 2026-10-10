import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
    View,
    StyleSheet,
    LayoutAnimation,
    UIManager,
    Platform,
    TouchableOpacity,
    Animated as RNAnimated,
    Easing,
} from "react-native";
import Svg, { Circle, G } from "react-native-svg";

const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);
import { Check, LockSimple, Target, Fire, CalendarCheck } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRings } from "@/hooks/useRings";
import { useAuth } from "@/hooks/useAuth";
import { RingProgress, RingState, RingRewardResponse } from "@/api/types";
import { RING_COLORS } from "@shared/rings";
import ExpandedRingDetail from "./ExpandedRingDetail";
import EncourageModal from "@/components/modals/EncourageModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import RewardUnboxingModal from "@/components/modals/RewardUnboxingModal";
import ScoreRamp from "@/components/onboarding/ScoreRamp";
import { useCoachRing } from "@/utils/onboardingV2/coachRing";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { ONBOARDING_V2_DONE } from "@/utils/onboardingV2/machine";

import DefaultModal from "@/components/modals/DefaultModal";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import { showToast } from "@/utils/showToast";

// Mirrors the scoring weights in backend/internal/handlers/rings/service.go.
// Each is a ceiling, not a guaranteed add: they only max out if you fully
// earn that category, which is why they won't sum to your current score.
const SCORE_BREAKDOWN = [
    { Icon: Target, label: "Close your rings", detail: "counted over the last 7 days", points: "up to 55" },
    { Icon: Fire, label: "Keep your streak alive", detail: "+1 per streak day", points: "up to 7" },
    { Icon: CalendarCheck, label: "Show up daily", detail: "close at least one ring", points: "up to 8" },
];

// Rings scale in and out during the coach: wait, then glide slowly.
const BIG_RINGS = 240;
const BLOW_DELAY_MS = 600;
const BLOW_MS = 1100;

const AnimatedThemedText = RNAnimated.createAnimatedComponent(ThemedText);

/** The score number; flashes success green whenever it goes up. */
function FlashingScore({ score }: { score: number }) {
    const ThemedColor = useThemeColor();
    const prev = useRef(score);
    const flash = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        // A rise from 0 is the first load, not a gain.
        if (prev.current > 0 && score > prev.current) {
            flash.setValue(0);
            RNAnimated.sequence([
                RNAnimated.timing(flash, { toValue: 1, duration: 150, useNativeDriver: false }),
                RNAnimated.delay(900),
                RNAnimated.timing(flash, { toValue: 0, duration: 400, useNativeDriver: false }),
            ]).start();
        }
        prev.current = score;
    }, [score, flash]);

    const color = flash.interpolate({ inputRange: [0, 1], outputRange: [ThemedColor.text, ThemedColor.success] });
    return (
        <AnimatedThemedText type="subtitle" style={{ color }}>
            {score}
        </AnimatedThemedText>
    );
}

/** Productivity score number, tappable to (re-)explain how the score works. */
export function ScoreWithInfo({ score }: { score: number }) {
    const [showInfo, setShowInfo] = useState(false);
    const { ready, done } = useFirstTouchHint("productivity_score");
    const ThemedColor = useThemeColor();
    const { step } = useOnboardingV2Context();
    const [ramping, setRamping] = useState(false);
    const prevStep = useRef(step);
    // The coach's finish is step 7, so the score is revealed once it is behind us.
    const inOnboarding = step !== null && step <= 7;

    // Ramp only when the finish step ends in this session, never on mount or a skip.
    useEffect(() => {
        if (prevStep.current === 7 && step !== null && step > 7) setRamping(true);
        prevStep.current = step;
    }, [step]);

    useEffect(() => {
        if (ready) setShowInfo(true);
    }, [ready]);

    const closeInfo = useCallback(
        (visible: boolean) => {
            setShowInfo(visible);
            if (!visible) done();
        },
        [done]
    );

    return (
        <>
            <TouchableOpacity onPress={() => setShowInfo(true)} activeOpacity={0.8} hitSlop={8}>
                {inOnboarding ? (
                    <ThemedText type="subtitle">0</ThemedText>
                ) : ramping ? (
                    <ScoreRamp target={score} playing onDone={() => setRamping(false)} type="subtitle" />
                ) : (
                    <FlashingScore score={score} />
                )}
            </TouchableOpacity>
            <DefaultModal visible={showInfo} setVisible={closeInfo} enableDynamicSizing>
                <View style={infoStyles.header}>
                    <ThemedText type="hero">{score}</ThemedText>
                    <ThemedText type="title" style={infoStyles.title}>
                        Introducing your Productivity Score
                    </ThemedText>
                </View>

                <View style={infoStyles.rows}>
                    {SCORE_BREAKDOWN.map(({ Icon, label, detail, points }) => (
                        <View key={label} style={infoStyles.row}>
                            <View style={[infoStyles.iconBadge, { backgroundColor: ThemedColor.primary + "20" }]}>
                                <Icon size={18} color={ThemedColor.primary} weight="fill" />
                            </View>
                            <View style={infoStyles.rowText}>
                                <ThemedText type="defaultSemiBold">{label}</ThemedText>
                                <ThemedText type="caption" style={{ opacity: 0.6 }}>{detail}</ThemedText>
                            </View>
                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                                {points}
                            </ThemedText>
                        </View>
                    ))}
                </View>

                <ThemedText type="caption" style={infoStyles.footnote}>
                    Everyone starts at 30. These are ceilings, not guaranteed points: earn a share of each to climb toward 100.
                </ThemedText>

                <PrimaryButton title="Got it" onPress={() => closeInfo(false)} style={infoStyles.button} />
            </DefaultModal>
        </>
    );
}

const infoStyles = StyleSheet.create({
    header: {
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        letterSpacing: -1,
        textAlign: "center",
        marginTop: 4,
    },
    rows: {
        gap: 14,
        marginBottom: 16,
    },
    footnote: {
        opacity: 0.6,
        lineHeight: 18,
        marginBottom: 20,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    rowText: {
        flex: 1,
        gap: 1,
    },
    button: {
        marginBottom: 32,
    },
});

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

type RingKey = "plan" | "do" | "share";

const MIN_SLIVER = 0.03;

// Memoized so a parent re-render (e.g. changing which ring is dimmed) doesn't
// re-render the animated arc and reset its fill mid-animation.
const RingArc = React.memo(function RingArc({
    progress,
    trackColor,
    color,
    size,
    radius,
    strokeWidth,
    delay = 0,
}: {
    progress: RingProgress;
    trackColor: string;
    color: string;
    size: number;
    radius: number;
    strokeWidth: number;
    delay?: number; // one-time entrance delay (staggered tutorial reveal)
}) {
    // Floor at a small sliver so an empty ring still shows its color.
    const fraction = Math.max(
        progress.target > 0 ? Math.min(progress.current / progress.target, 1) : 0,
        MIN_SLIVER
    );
    const circumference = 2 * Math.PI * radius;
    const animatedValue = useRef(new RNAnimated.Value(0)).current;
    const firstRun = useRef(true);

    useEffect(() => {
        // Only the first fill honors the stagger delay; later changes (e.g. a
        // ring closing) animate immediately.
        const d = firstRun.current ? delay : 0;
        firstRun.current = false;
        animatedValue.setValue(0);
        RNAnimated.timing(animatedValue, {
            toValue: fraction,
            duration: 800,
            delay: d,
            useNativeDriver: false,
        }).start();
    }, [fraction]);

    const strokeDashoffset = useMemo(
        () => animatedValue.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] }),
        [animatedValue, circumference]
    );
    const c = size / 2;

    return (
        <>
            <Circle cx={c} cy={c} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
            <AnimatedCircle
                cx={c}
                cy={c}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${c}, ${c}`}
            />
        </>
    );
});

function RingCircle(props: { progress: RingProgress; trackColor: string; color: string }) {
    return (
        <Svg width={RING_SIZE} height={RING_SIZE}>
            <RingArc {...props} size={RING_SIZE} radius={RADIUS} strokeWidth={STROKE_WIDTH} />
        </Svg>
    );
}

const RING_ORDER: RingKey[] = ["plan", "do", "share"];

/** Plan / Do / Share drawn as one concentric set, outer to inner, with optional center content. */
function ConcentricRings({
    rings,
    size = 132,
    strokeWidth = 12,
    gap = 4,
    dimmedExcept,
    staggerMs = 0,
    center,
}: {
    rings: Record<RingKey, RingProgress>;
    size?: number;
    strokeWidth?: number;
    gap?: number;
    dimmedExcept?: RingKey | null;
    staggerMs?: number;
    center?: React.ReactNode;
}) {
    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                {RING_ORDER.map((key, index) => (
                    <G key={key} opacity={dimmedExcept && dimmedExcept !== key ? 0.3 : 1}>
                        <RingArc
                            progress={rings[key]}
                            trackColor={RING_COLORS[key] + "1A"}
                            color={RING_COLORS[key]}
                            size={size}
                            radius={(size - strokeWidth) / 2 - index * (strokeWidth + gap)}
                            strokeWidth={strokeWidth}
                            delay={staggerMs ? index * staggerMs : 0}
                        />
                    </G>
                ))}
            </Svg>
            {center && <View style={styles.stackCenter}>{center}</View>}
        </View>
    );
}

interface ProductivityRingsCardProps {
    expanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
    // "rings" on home, "score" on profile, "full" shows both
    variant?: "full" | "rings" | "score";
    // Onboarding tutorial: render these rings instead of the user's live data,
    // and make them non-interactive (read-only demo).
    ringsOverride?: RingState;
    // Onboarding tutorial: stagger each ring's entrance by this many ms (0 = off).
    staggerMs?: number;
    // Smaller ring set where vertical room is tight (home focus stage)
    compact?: boolean;
    // Render the claim button elsewhere (home puts it below the focus stack)
    hideClaim?: boolean;
}

const ProductivityRingsCard: React.FC<ProductivityRingsCardProps> = ({
    expanded,
    onExpandChange,
    variant = "full",
    ringsOverride,
    staggerMs = 0,
    compact = false,
    hideClaim = false,
}) => {
    const showScore = variant !== "rings";
    const showRings = variant !== "score";
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const { rings, score, streak, isLoading, history, allClosed } = useRings();
    const [expandedRing, setExpandedRing] = useState<RingKey | null>(null);
    const coachRing = useCoachRing();
    const spotlitRing = expandedRing ?? coachRing;

    // While the coach explains the rings (steps 4-5) the home rings blow up to double size, then ease back.
    const { step: coachStep } = useOnboardingV2Context();
    // Home rings: while the coach explains them (steps 4-5) they blow up to double size, then ease back.
    // The graphic is always built at double size and `blowScale` (attached from the first render, never
    // reset) rests at 0.5. Growing flips the outer height first, then scales 0.5 -> 1; shrinking scales
    // 1 -> 0.5 first and only then collapses the height, so nothing ever jumps.
    const homeRings = variant === "rings" && compact;
    const blownUp = homeRings && (coachStep === 4 || coachStep === 5);
    const [bigLayout, setBigLayout] = useState(false);
    const blowScale = useRef(new RNAnimated.Value(0.5)).current;
    useEffect(() => {
        if (!homeRings) return;
        blowScale.stopAnimation();
        if (blownUp) {
            setBigLayout(true);
            RNAnimated.sequence([
                RNAnimated.delay(BLOW_DELAY_MS),
                RNAnimated.timing(blowScale, { toValue: 1, duration: BLOW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            ]).start();
        } else {
            RNAnimated.sequence([
                RNAnimated.delay(BLOW_DELAY_MS),
                RNAnimated.timing(blowScale, { toValue: 0.5, duration: BLOW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            ]).start(({ finished }) => {
                if (finished) setBigLayout(false);
            });
        }
    }, [blownUp, homeRings, blowScale]);

    // Staggered entrance (tutorial): each ring fades + scales in, one after another
    const entranceValues = useRef([0, 1, 2].map(() => new RNAnimated.Value(staggerMs ? 0 : 1))).current;
    useEffect(() => {
        if (!staggerMs) return;
        entranceValues.forEach((v) => v.setValue(0));
        RNAnimated.stagger(
            staggerMs,
            entranceValues.map((v) =>
                RNAnimated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true })
            )
        ).start();
    }, [staggerMs]);

    // Sync with parent: when blur overlay is dismissed, clear internal state
    React.useEffect(() => {
        if (expanded === false && expandedRing !== null) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedRing(null);
        }
    }, [expanded]);

    const trackColor = ThemedColor.tertiary;

    const handleRingPress = useCallback(
        (key: RingKey) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const newExpanded = expandedRing === key ? null : key;
            setExpandedRing(newExpanded);
            onExpandChange?.(newExpanded !== null);
        },
        [expandedRing, onExpandChange]
    );

    const effectiveRings = ringsOverride ?? rings;
    if (!effectiveRings || (!ringsOverride && isLoading)) {
        return null;
    }

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: effectiveRings.plan },
        { key: "do", label: "Do", progress: effectiveRings.do },
        { key: "share", label: "Share", progress: effectiveRings.share },
    ];

    const isExpanded = expandedRing !== null;

    return (
        <View
            style={[
                styles.card,
                // Home rings card is visually borderless — interior side padding
                // just reads as extra page gutter there
                variant === "rings" && { paddingHorizontal: 0 },
                styles.cardExpanded,
            ]}
        >
            {/* Private label — hidden on the home rings card */}
            {variant !== "rings" && (
                <View style={styles.privateRow}>
                    <LockSimple size={12} color={ThemedColor.caption} />
                    <ThemedText type="caption" style={{ opacity: 0.6 }}>
                        Only visible to you
                    </ThemedText>
                </View>
            )}

            {/* Score Arc */}
            {showScore && (
                <View style={[styles.arcSection, { marginBottom: 8 }]}>
                    <ScoreWithInfo score={score} />
                </View>
            )}

            {/* Rings Row */}
            {showRings && (
            <>
            <View style={compact ? styles.compactStack : styles.stackRow}>
                <RNAnimated.View
                    style={{
                        opacity: entranceValues[0],
                        transform: [{ scale: entranceValues[0].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                    }}
                >
                    {homeRings ? (
                        // Layout box: 120 at rest, 240 while blown up. The 240 graphic inside is scaled about its top.
                        <View style={{ width: BIG_RINGS, height: bigLayout ? BIG_RINGS : BIG_RINGS / 2 }}>
                            <RNAnimated.View
                                style={{
                                    width: BIG_RINGS,
                                    height: BIG_RINGS,
                                    transform: [
                                        { translateY: blowScale.interpolate({ inputRange: [0.5, 1], outputRange: [-BIG_RINGS / 4, 0] }) },
                                        { scale: blowScale },
                                    ],
                                }}
                            >
                                <ConcentricRings
                                    rings={effectiveRings}
                                    size={BIG_RINGS}
                                    strokeWidth={22}
                                    gap={8}
                                    dimmedExcept={spotlitRing}
                                    staggerMs={staggerMs}
                                    // Counter-scaled so the score reads at its normal size when the graphic rests at 0.5
                                    center={!ringsOverride && <View style={{ transform: [{ scale: 2 }] }}><ScoreWithInfo score={score} /></View>}
                                />
                            </RNAnimated.View>
                        </View>
                    ) : (
                        <ConcentricRings
                            rings={effectiveRings}
                            size={compact ? 120 : undefined}
                            strokeWidth={compact ? 11 : undefined}
                            dimmedExcept={spotlitRing}
                            staggerMs={staggerMs}
                            center={!ringsOverride && <ScoreWithInfo score={score} />}
                        />
                    )}
                </RNAnimated.View>

                <View style={compact ? styles.compactLegend : styles.legend}>
                    {ringEntries.map(({ key, label, progress }, index) => {
                        const ev = entranceValues[index];
                        return (
                            <RNAnimated.View key={key} style={{ opacity: ev }}>
                                <TouchableOpacity
                                    style={[styles.legendRow, spotlitRing !== null && spotlitRing !== key && { opacity: 0.3 }]}
                                    onPress={() => handleRingPress(key)}
                                    disabled={!!ringsOverride}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.legendDot, { backgroundColor: RING_COLORS[key] }]} />
                                    <ThemedText type={compact ? "caption" : "default"} style={compact ? undefined : styles.legendLabel}>
                                        {label}
                                    </ThemedText>
                                    {progress.closed ? (
                                        <Check size={compact ? 12 : 16} color={RING_COLORS[key]} weight="bold" />
                                    ) : (
                                        <ThemedText style={[styles.ringText, compact && { fontSize: 13 }, { color: ThemedColor.text }]}>
                                            {progress.current}/{progress.target}
                                        </ThemedText>
                                    )}
                                </TouchableOpacity>
                            </RNAnimated.View>
                        );
                    })}
                </View>
            </View>

            {/* Expanded detail */}
            {expandedRing && (
                <ExpandedRingDetail
                    ringKey={expandedRing}
                    todayRing={effectiveRings[expandedRing]}
                    history={history}
                />
            )}

            {!hideClaim && !expandedRing && <RingRewardClaim />}
            </>
            )}
        </View>
    );
};

// Claim button + unboxing for a day with every ring closed; renders nothing otherwise.
export function RingRewardClaim() {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const { canClaimReward, claimReward, isClaiming } = useRings();
    const [showUnboxing, setShowUnboxing] = useState(false);
    const [rewardResult, setRewardResult] = useState<RingRewardResponse | null>(null);

    const handleClaim = async () => {
        try {
            const result = await claimReward();
            if (result.claimed) {
                setRewardResult(result);
                setShowUnboxing(true);
            } else {
                showToast("Reward not available yet.", "warning");
            }
        } catch (error) {
            console.error("Claim reward error:", error);
            showToast("Failed to claim reward. Try again.", "danger");
        }
    };


    return (
        <>
            {/* Claim reward button */}
            {canClaimReward && (
                <PrimaryButton
                    title={isClaiming ? "Claiming..." : "Claim Reward"}
                    onPress={handleClaim}
                    disabled={isClaiming}
                    style={{
                        shadowColor: ThemedColor.primary,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 6,
                    }}
                />
            )}

            {/* Unboxing modal */}
            <RewardUnboxingModal
                visible={showUnboxing}
                setVisible={setShowUnboxing}
                rewardType={rewardResult?.credit_type ?? "naturalLanguage"}
                rewardAmount={rewardResult?.amount ?? 1}
                newTotal={
                    rewardResult?.credit_type && user?.credits
                        ? (user.credits[rewardResult.credit_type as keyof typeof user.credits] ?? 0)
                        : undefined
                }
            />
        </>
    );
}

const styles = StyleSheet.create({
    privateRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    card: {
        paddingHorizontal: 20,
        gap: 20,
    },
    cardExpanded: {
        zIndex: 999,
    },
    arcSection: {
        alignItems: "center",
        gap: 4,
    },
    ringsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    stackRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
    },
    stackCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    // Home: rings centered with one quiet Plan · Do · Share line under them
    compactStack: {
        alignItems: "center",
        gap: 8,
    },
    compactLegend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16,
    },
    legend: {
        flex: 1,
        gap: 12,
    },
    legendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendLabel: {
        flex: 1,
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

/**
 * Simplified rings-only view for friend profiles.
 * Tapping a ring opens an encourage modal with a ring-specific message.
 */
interface FriendRingsProps {
    ringState: RingState;
    userId: string;
    userHandle?: string;
    userName?: string;
}

const RING_ENCOURAGE_MESSAGES: Record<RingKey, string> = {
    plan: "Plan out your day and close that ring!",
    do: "Finish up those tasks, you're almost there!",
    share: "Post something or send some kudos to close the ring!",
};

const FriendRings: React.FC<FriendRingsProps> = ({ ringState, userId, userHandle, userName }) => {
    const ThemedColor = useThemeColor();
    const trackColor = ThemedColor.tertiary;
    const [showEncourageModal, setShowEncourageModal] = useState(false);
    const [selectedRingMessage, setSelectedRingMessage] = useState("");

    const ringEntries: { key: RingKey; label: string; progress: RingProgress }[] = [
        { key: "plan", label: "Plan", progress: ringState.plan },
        { key: "do", label: "Do", progress: ringState.do },
        { key: "share", label: "Share", progress: ringState.share },
    ];

    const handleRingPress = (key: RingKey, progress: RingProgress) => {
        if (progress.closed) return; // No encouragement needed for closed rings
        setSelectedRingMessage(RING_ENCOURAGE_MESSAGES[key]);
        setShowEncourageModal(true);
    };

    return (
        <>
            <View style={styles.ringsRow}>
                {ringEntries.map(({ key, label, progress }) => (
                    <TouchableOpacity
                        key={label}
                        style={styles.ringItem}
                        onPress={() => handleRingPress(key, progress)}
                        activeOpacity={progress.closed ? 1 : 0.7}
                    >
                        <View style={styles.ringWrapper}>
                            <RingCircle progress={progress} trackColor={trackColor} color={RING_COLORS[key]} />
                            <View style={styles.ringCenter}>
                                {progress.closed ? (
                                    <Check size={24} color={RING_COLORS[key]} weight="bold" />
                                ) : (
                                    <ThemedText
                                        style={[styles.ringText, { color: ThemedColor.text }]}
                                    >
                                        {progress.current}/{progress.target}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                        <ThemedText
                            style={[styles.ringLabel, { color: ThemedColor.caption }]}
                        >
                            {label.toUpperCase()}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={undefined}
                encouragementConfig={{
                    userHandle: userHandle || userName || "User",
                    receiverId: userId,
                    categoryName: "",
                }}
                isProfileLevel={true}
                defaultMessage={selectedRingMessage}
            />
        </>
    );
};

export { ProductivityRingsCard, FriendRings, ConcentricRings, RING_ENCOURAGE_MESSAGES };
export type { RingKey };
export default ProductivityRingsCard;
