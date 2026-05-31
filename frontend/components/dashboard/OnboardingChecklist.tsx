import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastable } from 'react-native-toastable';
import { ThemedText } from '@/components/ThemedText';
import DefaultToast from '@/components/ui/DefaultToast';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useCreateModal } from '@/contexts/createModalContext';
import { HORIZONTAL_PADDING } from '@/constants/spacing';
import {
    computeCompletion,
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

        (['task', 'kudos', 'friend', 'rings'] as ItemKey[]).forEach((key) => {
            if (!prev[key] && completion[key]) {
                showToastable({
                    title: 'Onboarding',
                    message: TOAST_COPY[key],
                    status: 'success',
                    duration: 3500,
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        });

        lastSnapshotRef.current = completion;
        AsyncStorage.setItem(snapshotKey(user._id), JSON.stringify(completion)).catch(() => {});
    }, [completion, user?._id]);

    if (!completion || dismissed === null || !shouldShowCard(completion, dismissed)) return null;

    return (
        <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 18 }}>
            <View
                style={{
                    backgroundColor: ThemedColor.lightenedCard,
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                        Get started on Kindred
                    </ThemedText>
                    <ThemedText style={{ fontSize: 12, color: ThemedColor.primary }}>
                        {totalDone} of 4
                    </ThemedText>
                </View>

                <View
                    style={{
                        height: 8,
                        backgroundColor: ThemedColor.tertiary,
                        borderRadius: 100,
                        marginTop: 10,
                        marginBottom: 14,
                        overflow: 'hidden',
                    }}>
                    <View
                        style={{
                            width: `${(totalDone / 4) * 100}%`,
                            height: '100%',
                            backgroundColor: ThemedColor.primary,
                            borderRadius: 100,
                        }}
                    />
                </View>

                {visible.map((key) => (
                    <ChecklistRow
                        key={key}
                        label={LABELS[key]}
                        onPress={() => handleRowPress(key)}
                        ThemedColor={ThemedColor}
                    />
                ))}

                <TouchableOpacity
                    onPress={handleDismiss}
                    style={{ alignSelf: 'flex-end', paddingVertical: 6, marginTop: 4 }}>
                    <ThemedText type="caption" style={{ fontSize: 12 }}>
                        Dismiss
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};

interface ChecklistRowProps {
    label: string;
    onPress: () => void;
    ThemedColor: ReturnType<typeof useThemeColor>;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ label, onPress, ThemedColor }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
        <View
            style={{
                width: 18,
                height: 18,
                borderRadius: 100,
                borderWidth: 1.5,
                borderColor: ThemedColor.caption,
            }}
        />
        <ThemedText style={{ flex: 1, fontSize: 14 }}>{label}</ThemedText>
        <ThemedText style={{ color: ThemedColor.caption, fontSize: 14 }}>›</ThemedText>
    </TouchableOpacity>
);
