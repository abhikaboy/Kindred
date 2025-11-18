import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, useColorScheme, Alert } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import KudosProgressCard from "@/components/cards/KudosProgressCard";
import BasicCard from "@/components/cards/BasicCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { useAuth } from "@/hooks/useAuth";
import Feather from "@expo/vector-icons/Feather";
import RewardRedemptionModal, { RewardInfo } from "@/components/modals/RewardRedemptionModal";
import { redeemRewardAPI } from "@/api/rewards";
import PrimaryButton from "@/components/inputs/PrimaryButton";

// Reward definitions (all cost 12 kudos)
const REWARDS: RewardInfo[] = [
    {
        type: "voice",
        title: "2 Voice Credits",
        description: "Create tasks using voice input",
        kudosCost: 12,
        creditsAmount: 2,
    },
    {
        type: "naturalLanguage",
        title: "2 Natural Language Credits",
        description: "Create tasks using natural language processing",
        kudosCost: 12,
        creditsAmount: 2,
    },
    {
        type: "group",
        title: "1 Group Credit",
        description: "Create a new group to collaborate with others",
        kudosCost: 12,
        creditsAmount: 1,
    },
    {
        type: "integration",
        title: "24 Hour Integration Usage",
        description: "Connect external services for 24 hours",
        kudosCost: 12,
    },
    {
        type: "analytics",
        title: "1 Analytics Credit",
        description: "Access your productivity analytics report",
        kudosCost: 12,
        creditsAmount: 1,
    },
];

export default function KudosRewards() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const { user, updateUser } = useAuth();
    
    const [selectedReward, setSelectedReward] = useState<RewardInfo | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Get sent counts from user's kudosRewards for progress tracking
    const encouragementsProgress = user?.kudosRewards?.encouragements || 0;
    const congratulationsProgress = user?.kudosRewards?.congratulations || 0;

    const styles = createStyles(ThemedColor, insets);

    const handleRewardPress = (reward: RewardInfo) => {
        // Check if integration is disabled
        if (reward.type === "integration") {
            Alert.alert("Coming Soon", "Integration rewards are not yet available.");
            return;
        }
        
        // Check if user has enough of either kudos type
        if (encouragementsProgress < reward.kudosCost && congratulationsProgress < reward.kudosCost) {
            Alert.alert("Insufficient Kudos", `You need ${reward.kudosCost} encouragements or ${reward.kudosCost} congratulations to claim this reward.`);
            return;
        }
        
        setSelectedReward(reward);
        setIsModalVisible(true);
    };

    const handleConfirmRedemption = async (kudosType: "encouragements" | "congratulations") => {
        if (!selectedReward) return;
        
        setIsRedeeming(true);
        
        try {
            const response = await redeemRewardAPI(selectedReward.type, kudosType);
            
            // Update user's kudos in local state based on which type was used
            const updatedUser: any = {
                kudosRewards: {
                    encouragements: kudosType === "encouragements" 
                        ? encouragementsProgress - selectedReward.kudosCost 
                        : encouragementsProgress,
                    congratulations: kudosType === "congratulations" 
                        ? congratulationsProgress - selectedReward.kudosCost 
                        : congratulationsProgress,
                },
            };
            
            // Add credit updates
            if (user?.credits) {
                if (selectedReward.type === "voice") {
                    updatedUser.credits = { ...user.credits, voice: user.credits.voice + (selectedReward.creditsAmount || 0) };
                } else if (selectedReward.type === "naturalLanguage") {
                    updatedUser.credits = { ...user.credits, naturalLanguage: user.credits.naturalLanguage + (selectedReward.creditsAmount || 0) };
                } else if (selectedReward.type === "group") {
                    updatedUser.credits = { ...user.credits, group: user.credits.group + (selectedReward.creditsAmount || 0) };
                } else if (selectedReward.type === "analytics") {
                    updatedUser.credits = { ...user.credits, analytics: user.credits.analytics + (selectedReward.creditsAmount || 0) };
                }
            }
            
            updateUser(updatedUser);
            
            Alert.alert(
                "Success!",
                `You've claimed ${selectedReward.title}! ${response.creditsReceived ? `+${response.creditsReceived} credits added to your account.` : ""}`,
                [{ text: "OK" }]
            );
            
            setIsModalVisible(false);
            setSelectedReward(null);
        } catch (error: any) {
            console.error("Failed to redeem reward:", error);
            Alert.alert(
                "Error",
                error?.message || "Failed to redeem reward. Please try again.",
                [{ text: "OK" }]
            );
        } finally {
            setIsRedeeming(false);
        }
    };

    const handleCancelRedemption = () => {
        setSelectedReward(null);
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {/* Back Button */}
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backArrow}>
                        ←
                    </ThemedText>
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.headerSection}>
                    <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                        Kudos Rewards
                    </ThemedText>
                </View>

                <View style={{ gap: 0 }}>
                    {/* Encouragements Section */}
                    <KudosProgressCard
                        current={encouragementsProgress}
                        max={KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX}
                        type="encouragements"
                        description="Encouragements"
                        showNavigation={false}
                    />

                    {/* Congratulations Section */}
                    <KudosProgressCard
                        current={congratulationsProgress}
                        max={KUDOS_CONSTANTS.CONGRATULATIONS_MAX}
                        type="congratulations"
                        description="Congratulations"
                        showNavigation={false}
                    />
                </View>

                {/* Magic Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={require("@/assets/images/210.Magic.png")}
                        style={[styles.magicImage, colorScheme === "dark" && { tintColor: "white" }]}
                        resizeMode="contain"
                    />
                </View>

                {/* Benefits Section */}
                <View style={{ flexDirection: "column", gap: 12 }}>
                    <ThemedText type="defaultSemiBold" style={styles.benefitsTitle}>
                        THE BENEFITS OF COMMUNITY
                    </ThemedText>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "rgba(100, 100, 255, 0.1)",
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            gap: 8,
                        }}>
                        <Feather name="trending-up" size={20} color={ThemedColor.primary} />
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 14, opacity: 0.8}}>
                            In Development
                        </ThemedText>
                    </View>
                </View>

                <ThemedText type="default" style={styles.benefitsDescription}>
                    Unlock Premium features of Kindred by sending any form of kudos to your friends, and people around
                    you
                </ThemedText>

                {/* Kudos Balance Display */}
                <View style={[styles.balanceCard, { backgroundColor: ThemedColor.lightenedCard }]}>
                    <ThemedText type="defaultSemiBold" style={styles.balanceLabel}>
                        Your Kudos Balance
                    </ThemedText>
                    <View style={styles.balanceRow}>
                        <View style={styles.balanceItem}>
                            <ThemedText type="title" style={[styles.balanceAmount, { color: ThemedColor.primary }]}>
                                {encouragementsProgress}
                            </ThemedText>
                            <ThemedText type="caption" style={styles.balanceType}>
                                Encouragements
                            </ThemedText>
                        </View>
                        <View style={styles.balanceDivider} />
                        <View style={styles.balanceItem}>
                            <ThemedText type="title" style={[styles.balanceAmount, { color: ThemedColor.primary }]}>
                                {congratulationsProgress}
                            </ThemedText>
                            <ThemedText type="caption" style={styles.balanceType}>
                                Congratulations
                            </ThemedText>
                        </View>
                    </View>
                    <ThemedText type="caption" style={styles.balanceSubtext}>
                        Use either type to redeem rewards (12 kudos each)
                    </ThemedText>
                </View>

                {/* Rewards List */}
                <View style={styles.rewardsList}>
                    {REWARDS.map((reward, index) => {
                        const canAffordWithEncouragements = encouragementsProgress >= reward.kudosCost;
                        const canAffordWithCongratulations = congratulationsProgress >= reward.kudosCost;
                        const canAfford = canAffordWithEncouragements || canAffordWithCongratulations;
                        const isDisabled = reward.type === "integration";
                        
                        return (
                            <View
                                key={index}
                                style={[
                                    styles.rewardCard,
                                    { backgroundColor: ThemedColor.lightenedCard },
                                    isDisabled && { opacity: 0.6 },
                                ]}
                            >
                                <View style={styles.rewardHeader}>
                                    <View style={styles.rewardInfo}>
                                        <ThemedText type="defaultSemiBold" style={styles.rewardTitle}>
                                            {reward.title}
                                        </ThemedText>
                                        <ThemedText type="caption" style={styles.rewardDescription}>
                                            {reward.description}
                                        </ThemedText>
                                    </View>
                                    <View style={[styles.costBadge, { backgroundColor: "rgba(100, 100, 255, 0.15)" }]}>
                                        <ThemedText type="caption" style={[styles.costText, { color: ThemedColor.primary }]}>
                                            {reward.kudosCost} kudos
                                        </ThemedText>
                                    </View>
                                </View>
                                
                                {isDisabled ? (
                                    <View style={styles.comingSoonBadge}>
                                        <Feather name="clock" size={14} color={ThemedColor.text} style={{ opacity: 0.5 }} />
                                        <ThemedText type="caption" style={styles.comingSoonText}>
                                            Coming Soon
                                        </ThemedText>
                                    </View>
                                ) : canAfford ? (
                                    <PrimaryButton
                                        title="Claim"
                                        onPress={() => handleRewardPress(reward)}
                                        style={styles.claimButton}
                                        textStyle={styles.claimButtonText}
                                    />
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
            
            {/* Redemption Modal */}
            {selectedReward && (
                <RewardRedemptionModal
                    visible={isModalVisible}
                    setVisible={setIsModalVisible}
                    reward={selectedReward}
                    encouragementsBalance={encouragementsProgress}
                    congratulationsBalance={congratulationsProgress}
                    onConfirm={handleConfirmRedemption}
                    onCancel={handleCancelRedemption}
                    isRedeeming={isRedeeming}
                />
            )}
        </ThemedView>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
            gap: 12,
        },
        backButton: {
            alignSelf: "flex-start",
        },
        backArrow: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        headerSection: {
            gap: 8,
            paddingVertical: 4,
        },
        title: {
            fontSize: 32,
            color: ThemedColor.text,
            letterSpacing: -1,
        },
        imageContainer: {
            width: "75%",
            aspectRatio: 1,
            marginVertical: 16,
            alignSelf: "center",
        },
        magicImage: {
            width: "100%",
            height: "100%",
        },
        benefitsTitle: {
            fontSize: 16,
            color: ThemedColor.primary,
            fontWeight: "500",
        },
        benefitsDescription: {
            fontSize: 16,
            color: ThemedColor.text,
            lineHeight: 24,
        },
        rewardsList: {
            gap: 16,
            paddingBottom: 24,
        },
        rewardText: {
            fontSize: 16,
            color: ThemedColor.text,
        },
        balanceCard: {
            padding: 20,
            borderRadius: 12,
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
        },
        balanceLabel: {
            fontSize: 13,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        balanceRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 32,
        },
        balanceItem: {
            alignItems: "center",
            gap: 6,
        },
        balanceDivider: {
            width: 1,
            height: 32,
            backgroundColor: ThemedColor.text,
            opacity: 0.15,
        },
        balanceAmount: {
            fontSize: 28,
            fontWeight: "700",
        },
        balanceType: {
            fontSize: 12,
            opacity: 0.5,
        },
        balanceSubtext: {
            fontSize: 11,
            opacity: 0.5,
            textAlign: "center",
        },
        rewardCard: {
            padding: 16,
            borderRadius: 12,
            gap: 12,
        },
        rewardHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
        },
        rewardInfo: {
            flex: 1,
            gap: 4,
        },
        rewardTitle: {
            fontSize: 16,
        },
        rewardDescription: {
            fontSize: 13,
            opacity: 0.7,
            lineHeight: 18,
        },
        costBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
        },
        costText: {
            fontSize: 12,
            fontWeight: "600",
        },
        claimButton: {
            marginTop: 4,
            paddingVertical: 12,
        },
        claimButtonText: {
            fontSize: 13,
            fontWeight: "600",
        },
        disabledClaimButton: {
            opacity: 0.5,
        },
        comingSoonBadge: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            marginTop: 4,
        },
        comingSoonText: {
            fontSize: 12,
            opacity: 0.5,
            fontStyle: "italic",
        },
    });
