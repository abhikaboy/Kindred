import { StyleSheet, View, TouchableOpacity, Share } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AddressBook, ShareNetwork, Gift, ListChecks } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useReferral } from "@/hooks/useReferral";

type Props = {
    onSyncContacts?: () => void;
    isLoadingContacts?: boolean;
    isFindingFriends?: boolean;
};

type StepButtonConfig = {
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    variant?: "filled" | "outline";
};

type StepProps = {
    stepNumber: number;
    title: string;
    description: string;
    buttons: StepButtonConfig[];
    primaryColor: string;
    ThemedColor: any;
};

const OnboardingStep = ({ stepNumber, title, description, buttons, primaryColor, ThemedColor }: StepProps) => (
    <View style={stepStyles.container}>
        <View style={[stepStyles.badge, { backgroundColor: primaryColor }]}>
            <ThemedText type="smallerDefault" style={{ color: "#fff" }}>
                {stepNumber}
            </ThemedText>
        </View>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText type="caption" style={stepStyles.description}>
            {description}
        </ThemedText>
        <View style={stepStyles.buttons}>
            {buttons.map((btn, i) => (
                <TouchableOpacity
                    key={i}
                    style={[
                        stepStyles.actionBtn,
                        btn.variant === "outline"
                            ? { borderColor: ThemedColor.tertiary, borderWidth: 1 }
                            : { backgroundColor: primaryColor },
                    ]}
                    onPress={btn.onPress}
                    disabled={btn.disabled}
                    activeOpacity={0.7}>
                    {btn.icon}
                    <ThemedText
                        type="smallerDefault"
                        style={{ color: btn.variant === "outline" ? ThemedColor.text : "#fff" }}>
                        {btn.label}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>
    </View>
);

const BetterTogetherCard = ({ onSyncContacts, isLoadingContacts, isFindingFriends }: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { referralCode } = useReferral();

    const handleShareInvite = async () => {
        const message = referralCode
            ? `Join me on Kindred! Use my referral code "${referralCode}" when you sign up: https://kindred.so`
            : "Join me on Kindred! Download the app and let's grow together: https://kindred.so";
        try {
            await Share.share({ message });
        } catch (_) {}
    };

    const handleViewRewards = () => {
        router.push("/(logged-in)/rewards");
    };

    const handleGoToDaily = () => {
        router.push("/(logged-in)/(tabs)/(task)/daily");
    };

    const syncLabel = isLoadingContacts
        ? "Loading Contacts..."
        : isFindingFriends
          ? "Finding Friends..."
          : "Sync Contacts";

    return (
        <View style={rootStyles.container}>
            <ThemedText type="subtitle" style={[rootStyles.heading, { fontSize: 24, fontWeight: 500 }]}>
                Find Your People
            </ThemedText>
            <ThemedText type="lightBody" style={rootStyles.subtitle}>
                Kindred is built on friendships.{"\n"}Here's how to get started:
            </ThemedText>

            <View style={[rootStyles.divider, { backgroundColor: ThemedColor.tertiary }]} />

            <OnboardingStep
                stepNumber={1}
                title="Sync Your Contacts"
                description="Find friends who are already on Kindred from your phone contacts."
                buttons={[
                    {
                        label: syncLabel,
                        icon: <AddressBook size={16} color="#fff" weight="regular" />,
                        onPress: onSyncContacts ?? (() => {}),
                        disabled: isLoadingContacts || isFindingFriends,
                    },
                ]}
                primaryColor={ThemedColor.primary}
                ThemedColor={ThemedColor}
            />

            <OnboardingStep
                stepNumber={2}
                title="Invite & Earn Rewards"
                description="Share your referral code with friends. When they join, you unlock groups, analytics, voice notes, and more."
                buttons={[
                    {
                        label: "Share Referral",
                        icon: <ShareNetwork size={16} color="#fff" weight="regular" />,
                        onPress: handleShareInvite,
                    },
                    {
                        label: "View Rewards",
                        icon: <Gift size={16} color={ThemedColor.text} weight="regular" />,
                        onPress: handleViewRewards,
                        variant: "outline",
                    },
                ]}
                primaryColor={ThemedColor.primary}
                ThemedColor={ThemedColor}
            />

            <OnboardingStep
                stepNumber={3}
                title="Build Your Daily"
                description="Set up tasks, complete them, and send kudos to friends along the way."
                buttons={[
                    {
                        label: "Go to Daily",
                        icon: <ListChecks size={16} color={ThemedColor.text} weight="regular" />,
                        onPress: handleGoToDaily,
                        variant: "outline",
                    },
                ]}
                primaryColor={ThemedColor.primary}
                ThemedColor={ThemedColor}
            />
        </View>
    );
};

export default BetterTogetherCard;

const rootStyles = StyleSheet.create({
    container: {
        alignItems: "center",
        paddingHorizontal: 8,
        paddingTop: 24,
        paddingBottom: 8,
    },
    heading: {
        textAlign: "center",
    },
    subtitle: {
        textAlign: "center",
        marginTop: 6,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        width: "80%",
        marginVertical: 24,
    },
});

const stepStyles = StyleSheet.create({
    container: {
        alignItems: "center",
        marginBottom: 28,
        width: "100%",
    },
    badge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
    },
    description: {
        textAlign: "center",
        maxWidth: 280,
        marginTop: 2,
        marginBottom: 14,
    },
    buttons: {
        flexDirection: "row",
        gap: 10,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 24,
    },
});
