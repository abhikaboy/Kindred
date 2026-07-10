import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Share, Dimensions, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import Confetti from "@/components/ui/Confetti";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Plus,
    FolderSimple,
    Microphone,
    CalendarPlus,
    CheckCircle,
    UserCircle,
    Newspaper,
    Gif,
    Bell,
    MagnifyingGlass,
    UserPlus,
    AddressBook,
    ShareNetwork,
    type IconProps,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import PrimaryButton from '@/components/inputs/PrimaryButton';
import { RingsFillHero } from './RingsFillHero';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useReferral } from '@/hooks/useReferral';
import type { ItemKey } from '@/utils/onboardingChecklist';

const APP_STORE_URL = 'https://apps.apple.com/us/app/kindred-todo/id6744142764';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Hero scales down on short screens so the rest of the sheet still fits.
const HERO_HEIGHT = Math.round(Math.min(220, SCREEN_HEIGHT * 0.26));

interface Bullet {
    Icon: React.FC<IconProps>;
    label: string;
    text: string;
}

interface StepContent {
    title: string;
    intro: string;
    bullets: Bullet[];
    cta: string;
    // Hero art. Optional because the rings step renders the animated rings instead.
    image?: ImageSourcePropType;
}

const STEP_CONTENT: Record<ItemKey, StepContent> = {
    task: {
        title: 'Make your first task',
        intro: 'Everything in Kindred starts with a task — and the fastest way to make one is to just talk.',
        bullets: [
            {
                Icon: FolderSimple,
                label: 'Open a category',
                text: 'In a workspace, tap into the category where the task belongs.',
            },
            {
                Icon: Plus,
                label: 'Tap the purple +',
                text: 'Hit the + button to start something new.',
            },
            {
                Icon: Microphone,
                label: 'Just say it',
                text: 'Use voice input to create, update, and manage your tasks — Kindred does the work for you.',
            },
            {
                Icon: Bell,
                label: 'Reminders, automatically',
                text: 'Every task comes with reminders built in, so nothing slips through the cracks.',
            },
        ],
        cta: 'Create a task',
        image: require('../../assets/images/onboarding/task.jpg'),
    },
    kudos: {
        title: 'Send your first kudos',
        intro: 'Kudos are quick, private shout-outs you send a friend — a little cheer to turn their day around.',
        bullets: [
            {
                Icon: UserCircle,
                label: 'From a friend’s profile',
                text: 'Open any friend’s profile and tap the kudos button to send one.',
            },
            {
                Icon: Newspaper,
                label: 'Or right from the feed',
                text: 'When a friend posts an update, send kudos on it without leaving your feed.',
            },
            {
                Icon: Gif,
                label: 'Make it fun with a GIF',
                text: 'Drop in a GIF so your kudos lands with some personality.',
            },
            {
                Icon: Bell,
                label: 'Just for them',
                text: 'Kudos are private — yours lands on their notifications page, seen by no one else.',
            },
        ],
        cta: 'Send kudos',
        image: require('../../assets/images/onboarding/kudos.jpg'),
    },
    friend: {
        title: 'Add a friend',
        intro: 'Kindred works best with a few people who keep you honest. Friends see your progress, send kudos, and give you someone to show up for.',
        bullets: [
            {
                Icon: MagnifyingGlass,
                label: 'Search for people you know',
                text: 'Look them up by name or @handle, open their profile, and add them.',
            },
            {
                Icon: UserPlus,
                label: 'Invite friends to join',
                text: 'Not on Kindred yet? Share your invite link so they can join you.',
            },
            {
                Icon: AddressBook,
                label: 'Sync your contacts',
                text: 'Let Kindred match your contacts to people already here.',
            },
        ],
        cta: 'Find friends',
        image: require('../../assets/images/onboarding/friend.jpg'),
    },
    rings: {
        title: 'Close all 3 rings in a day',
        intro: 'Plan, Do, and Share fill as you move through your day. Close all three to claim your daily reward.',
        bullets: [
            { Icon: CalendarPlus, label: 'Plan', text: 'Create or schedule your tasks for the day' },
            { Icon: CheckCircle, label: 'Do', text: 'Check tasks off as you complete them' },
            { Icon: ShareNetwork, label: 'Share', text: 'Post an update or send a friend kudos' },
        ],
        cta: 'View your rings',
    },
};

interface OnboardingStepSheetProps {
    activeKey: ItemKey | null;
    onClose: () => void;
    onAction: (key: ItemKey) => void;
}

export const OnboardingStepSheet: React.FC<OnboardingStepSheetProps> = ({ activeKey, onClose, onAction }) => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { referralCode } = useReferral();
    const sheetRef = useRef<BottomSheetModal>(null);
    // Suppresses the close callback while we're driving the sheet open ourselves.
    const isPresentingRef = useRef(false);
    // Keeps the last content mounted through the close animation so it doesn't blank out.
    const lastKeyRef = useRef<ItemKey | null>(null);
    if (activeKey) lastKeyRef.current = activeKey;

    const handleRingsComplete = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, []);

    // Bumped each time the kudos sheet opens so the confetti cannon remounts and re-pops.
    const [kudosBurst, setKudosBurst] = useState(0);
    useEffect(() => {
        if (activeKey === 'kudos') setKudosBurst((n) => n + 1);
    }, [activeKey]);

    useEffect(() => {
        if (activeKey) {
            isPresentingRef.current = true;
            sheetRef.current?.present();
            const t = setTimeout(() => {
                isPresentingRef.current = false;
            }, 400);
            return () => clearTimeout(t);
        }
        sheetRef.current?.dismiss();
    }, [activeKey]);

    const handleChange = useCallback(
        (index: number) => {
            if (index === -1 && !isPresentingRef.current) onClose();
        },
        [onClose]
    );

    const renderBackdrop = useCallback(
        (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />
        ),
        []
    );

    const handleCTA = useCallback(() => {
        if (!activeKey) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const key = activeKey;
        sheetRef.current?.dismiss();
        onAction(key);
    }, [activeKey, onAction]);

    // Opens the native share sheet with the user's invite link (sheet stays open behind it).
    const handleInvite = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const code = referralCode ? ` Use my code "${referralCode}" when you sign up.` : '';
        Share.share({ message: `Join me on Kindred!${code} ${APP_STORE_URL}` }).catch(() => {});
    }, [referralCode]);

    const activeContentKey = lastKeyRef.current;
    const content = activeContentKey ? STEP_CONTENT[activeContentKey] : null;
    const isRings = activeContentKey === 'rings';
    const isFriend = activeContentKey === 'friend';
    const isKudos = activeContentKey === 'kudos';

    return (
        <BottomSheetModal
            ref={sheetRef}
            onChange={handleChange}
            enableDynamicSizing
            // Never grow past most of the screen — content scrolls instead on short devices.
            maxDynamicContentSize={SCREEN_HEIGHT * 0.92}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose>
            <BottomSheetScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 + insets.bottom, gap: 20 }}>
                {content && (
                    <>
                        {isRings ? (
                            <RingsFillHero play={activeKey === 'rings'} onComplete={handleRingsComplete} />
                        ) : (
                            content.image && (
                                <Image
                                    source={content.image}
                                    style={{ width: '100%', height: HERO_HEIGHT, borderRadius: 20, backgroundColor: ThemedColor.tertiary }}
                                    contentFit="cover"
                                    transition={200}
                                />
                            )
                        )}
                        <View style={{ gap: 6 }}>
                            <ThemedText type="titleFraunces">{content.title}</ThemedText>
                            <ThemedText type="larger_default_light">{content.intro}</ThemedText>
                        </View>
                        <View style={{ gap: 18 }}>
                            {content.bullets.map((bullet) => (
                                <View key={bullet.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                                    <bullet.Icon size={26} color={ThemedColor.text} weight="regular" style={{ marginTop: 2 }} />
                                    <View style={{ flex: 1 }}>
                                        <ThemedText type="subtitle">{bullet.label}</ThemedText>
                                        <ThemedText type="larger_default_light">{bullet.text}</ThemedText>
                                    </View>
                                </View>
                            ))}
                        </View>
                        {isFriend ? (
                            <View style={{ gap: 10, marginTop: 4 }}>
                                <PrimaryButton title="Invite a friend" onPress={handleInvite} />
                                <PrimaryButton title="Search & sync contacts" ghost onPress={handleCTA} />
                            </View>
                        ) : (
                            <PrimaryButton title={content.cta} onPress={handleCTA} style={{ marginTop: 4 }} />
                        )}
                    </>
                )}
            </BottomSheetScrollView>

            {/* Snappy pop when the kudos sheet opens; remounts via key for each open.
                Sibling of the scroll view so it doesn't scroll away. */}
            {isKudos && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Confetti autoStart />
                </View>
            )}
        </BottomSheetModal>
    );
};
