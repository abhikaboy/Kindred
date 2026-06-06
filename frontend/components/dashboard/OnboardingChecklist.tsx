import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastable } from 'react-native-toastable';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { ThemedText } from '@/components/ThemedText';
import DefaultToast from '@/components/ui/DefaultToast';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useCreateModal } from '@/contexts/createModalContext';
import { HORIZONTAL_PADDING } from '@/constants/spacing';
import {
    computeCompletion,
    computeCompletedItems,
    computeVisibleItems,
    shouldShowCard,
    type ChecklistUser,
    type CompletionMap,
    type ItemKey,
} from '@/utils/onboardingChecklist';

const LABELS: Record<ItemKey, string> = {
    task: 'Make your first task',
    kudos: 'Send your first kudos',
    friend: 'Add a friend',
    rings: 'Close all 3 rings in a day',
};

const TOAST_COPY: Record<ItemKey, string> = {
    task: 'Nice — first task done. Keep going.',
    kudos: 'First kudos sent. Spread the love.',
    friend: "Friend added. You're not alone in this.",
    rings: "All three rings closed. That's the move.",
};

const dismissKey = (userId: string) => `${userId}-onboarding-checklist-dismissed`;
const snapshotKey = (userId: string) => `${userId}-onboarding-checklist-snapshot`;

const ITEM_KEYS: ItemKey[] = ['task', 'kudos', 'friend', 'rings'];
const TOTAL_ITEMS = ITEM_KEYS.length;

// How long the "You're all set!" celebration holds before the card fades away.
const CELEBRATION_HOLD_MS = 2500;
const CELEBRATION_FADE_MS = 350;

const SCREEN_WIDTH = Dimensions.get('window').width;
const FALLBACK_CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

const allDone = (c: CompletionMap) => ITEM_KEYS.every((k) => c[k]);

interface OnboardingChecklistProps {
    scrollRef: React.RefObject<ScrollView>;
    kudosOffsetRef: React.MutableRefObject<number>;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ scrollRef, kudosOffsetRef }) => {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const { openModal } = useCreateModal();
    const [dismissed, setDismissed] = useState<boolean | null>(null);
    const [celebrating, setCelebrating] = useState(false);
    const [cardWidth, setCardWidth] = useState(FALLBACK_CARD_WIDTH);
    const cardOpacity = useRef(new Animated.Value(1)).current;
    const celebrationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(
        () => () => {
            celebrationTimers.current.forEach(clearTimeout);
        },
        []
    );

    useEffect(() => {
        if (!user?._id) return;
        let cancelled = false;
        AsyncStorage.getItem(dismissKey(user._id)).then((v) => {
            if (!cancelled) setDismissed(v === 'true');
        });
        return () => {
            cancelled = true;
        };
    }, [user?._id]);

    const handleDismiss = useCallback(() => {
        if (!user?._id) return;
        AsyncStorage.setItem(dismissKey(user._id), 'true').catch(() => {});
        setDismissed(true);
    }, [user?._id]);

    const completion = useMemo(() => {
        if (!user) return null;
        return computeCompletion(user as unknown as ChecklistUser);
    }, [user]);

    const visible = useMemo(() => (completion ? computeVisibleItems(completion) : []), [completion]);
    const completed = useMemo(() => (completion ? computeCompletedItems(completion) : []), [completion]);
    const totalDone = completion ? Object.values(completion).filter(Boolean).length : 0;

    const handleRowPress = useCallback(
        (key: ItemKey) => {
            switch (key) {
                case 'task':
                    openModal();
                    break;
                case 'kudos':
                    scrollRef.current?.scrollTo({ y: kudosOffsetRef.current, animated: true });
                    break;
                case 'friend':
                    router.push('/(logged-in)/(tabs)/(search)/search');
                    break;
                case 'rings':
                    router.push('/(logged-in)/(tabs)/(profile)/profile');
                    break;
            }
        },
        [openModal, router, scrollRef, kudosOffsetRef]
    );

    const triggerCelebration = useCallback(() => {
        setCelebrating(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        const fadeTimer = setTimeout(() => {
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: CELEBRATION_FADE_MS,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }).start(() => setCelebrating(false));
        }, CELEBRATION_HOLD_MS);

        celebrationTimers.current.push(fadeTimer);
    }, [cardOpacity]);

    const snapshotLoadedRef = useRef(false);
    const lastSnapshotRef = useRef<CompletionMap | null>(null);

    useEffect(() => {
        if (!user?._id || !completion) return;

        if (!snapshotLoadedRef.current) {
            snapshotLoadedRef.current = true;
            AsyncStorage.getItem(snapshotKey(user._id)).then((raw) => {
                if (raw) {
                    try {
                        lastSnapshotRef.current = JSON.parse(raw) as CompletionMap;
                    } catch {}
                }
                lastSnapshotRef.current = lastSnapshotRef.current ?? completion;
                AsyncStorage.setItem(snapshotKey(user._id), JSON.stringify(completion)).catch(() => {});
            });
            return;
        }

        const prev = lastSnapshotRef.current;
        if (!prev) return;

        const finishing = !allDone(prev) && allDone(completion);

        ITEM_KEYS.forEach((key) => {
            if (!prev[key] && completion[key]) {
                // The final item's payoff is the full-card celebration below —
                // a per-item haptic + toast there would just compete with it.
                if (!finishing) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    showToastable({
                        title: 'Onboarding',
                        message: TOAST_COPY[key],
                        status: 'success',
                        duration: 3500,
                        renderContent: (props) => <DefaultToast {...props} />,
                    });
                }
            }
        });

        if (finishing) triggerCelebration();

        lastSnapshotRef.current = completion;
        AsyncStorage.setItem(snapshotKey(user._id), JSON.stringify(completion)).catch(() => {});
    }, [completion, user?._id, triggerCelebration]);

    // `celebrating` keeps the card alive through the finish animation even
    // though shouldShowCard flips to false the instant all items are done.
    if (!completion || dismissed === null || (!shouldShowCard(completion, dismissed) && !celebrating)) return null;

    return (
        <Animated.View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 18, opacity: cardOpacity }}>
            <View
                onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
                style={{
                    backgroundColor: ThemedColor.lightenedCard,
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                    overflow: 'hidden',
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                        {celebrating ? "You're all set! 🎉" : 'Get started 🚀'}
                    </ThemedText>
                    {!celebrating && (
                        <ThemedText style={{ fontSize: 12, color: ThemedColor.primary }}>
                            {totalDone} of {TOTAL_ITEMS}
                        </ThemedText>
                    )}
                </View>

                {celebrating && (
                    <ThemedText style={{ fontSize: 13, color: ThemedColor.caption, marginTop: 4 }}>
                        Welcome to Kindred — you're ready to roll.
                    </ThemedText>
                )}

                <ProgressBar totalDone={totalDone} ThemedColor={ThemedColor} />

                {visible.map((key) => (
                    <ChecklistRow
                        key={key}
                        label={LABELS[key]}
                        onPress={() => handleRowPress(key)}
                        ThemedColor={ThemedColor}
                    />
                ))}

                {completed.map((key) => (
                    <ChecklistRow key={key} label={LABELS[key]} completed ThemedColor={ThemedColor} />
                ))}

                {!celebrating && (
                    <TouchableOpacity
                        onPress={handleDismiss}
                        style={{ alignSelf: 'flex-end', paddingVertical: 6, marginTop: 4 }}>
                        <ThemedText type="caption" style={{ fontSize: 12 }}>
                            Dismiss
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {/* Outside the card so the burst isn't clipped by the card's overflow:hidden. */}
            {celebrating && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <ConfettiCannon
                        count={120}
                        origin={{ x: cardWidth / 2, y: 0 }}
                        fallSpeed={2600}
                        explosionSpeed={320}
                        fadeOut
                        autoStart
                    />
                </View>
            )}
        </Animated.View>
    );
};

interface ChecklistRowProps {
    label: string;
    onPress?: () => void;
    completed?: boolean;
    ThemedColor: ReturnType<typeof useThemeColor>;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ label, onPress, completed = false, ThemedColor }) => {
    const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 } as const;

    const content = (
        <>
            <CheckCircle completed={completed} ThemedColor={ThemedColor} />
            <ThemedText
                style={{
                    flex: 1,
                    fontSize: 14,
                    color: completed ? ThemedColor.caption : undefined,
                    textDecorationLine: completed ? 'line-through' : 'none',
                }}>
                {label}
            </ThemedText>
            {!completed && <ThemedText style={{ color: ThemedColor.caption, fontSize: 14 }}>›</ThemedText>}
        </>
    );

    if (completed) {
        return <View style={rowStyle}>{content}</View>;
    }

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={rowStyle}>
            {content}
        </TouchableOpacity>
    );
};

interface CheckCircleProps {
    completed: boolean;
    ThemedColor: ReturnType<typeof useThemeColor>;
}

const CheckCircle: React.FC<CheckCircleProps> = ({ completed, ThemedColor }) => {
    const scale = useRef(new Animated.Value(completed ? 0 : 1)).current;

    useEffect(() => {
        if (!completed) return;
        scale.setValue(0);
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
    }, [completed, scale]);

    return (
        <Animated.View
            style={{
                width: 18,
                height: 18,
                borderRadius: 100,
                borderWidth: 1.5,
                borderColor: completed ? ThemedColor.primary : ThemedColor.caption,
                backgroundColor: completed ? ThemedColor.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale }],
            }}>
            {/* buttonText (white in both themes) keeps the check legible on the purple fill;
                ThemedColor.background would go near-black in dark mode. */}
            {completed && (
                <ThemedText style={{ color: ThemedColor.buttonText, fontSize: 11, lineHeight: 13 }}>✓</ThemedText>
            )}
        </Animated.View>
    );
};

interface ProgressBarProps {
    totalDone: number;
    ThemedColor: ReturnType<typeof useThemeColor>;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ totalDone, ThemedColor }) => {
    const fraction = totalDone / TOTAL_ITEMS;
    const widthAnim = useRef(new Animated.Value(fraction)).current;
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(widthAnim, {
            toValue: fraction,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [fraction, widthAnim]);

    // One step from done: a single glow to acknowledge the near-finish — fires
    // once when you reach the last item, not a continuous loop.
    useEffect(() => {
        if (totalDone !== TOTAL_ITEMS - 1) {
            pulse.setValue(1);
            return;
        }
        Animated.sequence([
            Animated.timing(pulse, { toValue: 0.5, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: false }),
            Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]).start();
    }, [totalDone, pulse]);

    const width = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
        <View
            style={{
                height: 8,
                backgroundColor: ThemedColor.tertiary,
                borderRadius: 100,
                marginTop: 10,
                marginBottom: 14,
                overflow: 'hidden',
            }}>
            <Animated.View
                style={{
                    width,
                    height: '100%',
                    backgroundColor: ThemedColor.primary,
                    borderRadius: 100,
                    opacity: pulse,
                }}
            />
        </View>
    );
};
