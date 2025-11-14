import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Dimensions, Alert, Share, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from 'expo-clipboard';
import { useReferral } from "@/hooks/useReferral";

type RewardItem = {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    unlocked?: boolean;
};

const REWARDS_DATA: RewardItem[] = [
    {
        id: "circles",
        icon: "ellipsis-horizontal-circle-outline",
        title: "2 Groups Credits",
        description: "Post to sub groups of your close friends instead of everyone on your friends list!",
    },
    {
        id: "analytics",
        icon: "stats-chart-outline",
        title: "Productivity Analytics",
        description: "Track your productivity trends and gain insights into your task completion patterns over time.",
    },
    {
        id: "voice",
        icon: "mic-outline",
        title: "5 Voice Dump Credits",
        description: "Record 5 voice notes to quickly capture your thoughts and ideas on the go.",
    },
    {
        id: "giphy",
        icon: "image-outline",
        title: "Unlimited Giphy Usage",
        description: "Express yourself with unlimited access to GIFs and animated reactions in your posts.",
    },
    {
        id: "badge",
        icon: "ribbon-outline",
        title: "Profile Badge",
        description: "Show off your supporter status with an exclusive badge displayed on your profile.",
    },
];

export default function Rewards() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const styles = useStyles(ThemedColor);
    const [copied, setCopied] = useState(false);

    // Use referral hook to get real data from backend
    const {
        referralCode,
        unlocksRemaining,
        isLoadingInfo,
        infoError,
    } = useReferral();

    const handleCopyCode = async () => {
        if (!referralCode) return;
        
        try {
            await Clipboard.setStringAsync(referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            Alert.alert("Error", "Failed to copy referral code");
        }
    };

    const handleShareCode = async () => {
        if (!referralCode) return;
        
        try {
            await Share.share({
                message: `Join me on Kindred! Use my referral code: ${referralCode}`,
            });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backIcon}>←</ThemedText>
                </TouchableOpacity>
                <View style={styles.backButton} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Title and Description */}
                <View style={styles.titleSection}>
                    <ThemedText type="titleFraunces" style={styles.title}>
                        Referral Rewards
                    </ThemedText>
                    <ThemedText type="default" style={styles.subtitle}>
                        Earn more unlocks when people you refer{'\n'}signup with your referral code!
                    </ThemedText>
                </View>

                {/* Referral Code Section */}
                <View style={styles.referralSection}>
                    <ThemedText type="defaultSemiBold" style={styles.referralTitle}>
                        Your Referral Code
                    </ThemedText>

                    <View style={[styles.codeContainer, { 
                        backgroundColor: ThemedColor.lightened,
                        borderColor: ThemedColor.tertiary
                    }]}>
                        {isLoadingInfo ? (
                            <ActivityIndicator size="small" color={ThemedColor.primary} />
                        ) : infoError ? (
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                {infoError}
                            </ThemedText>
                        ) : (
                            <ThemedText type="defaultSemiBold" style={styles.codeText}>
                                {referralCode || "------"}
                            </ThemedText>
                        )}
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity 
                            style={[styles.actionButton, { 
                                backgroundColor: ThemedColor.primary,
                                opacity: (!referralCode || isLoadingInfo) ? 0.5 : 1
                            }]}
                            onPress={handleCopyCode}
                            disabled={!referralCode || isLoadingInfo}
                        >
                            <Ionicons 
                                name={copied ? "checkmark" : "copy-outline"} 
                                size={18} 
                                color={ThemedColor.buttonText} 
                            />
                            <ThemedText style={[styles.buttonText, { color: ThemedColor.buttonText }]}>
                                {copied ? "Copied!" : "Copy"}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.actionButton, { 
                                backgroundColor: ThemedColor.lightened,
                                borderColor: ThemedColor.primary,
                                borderWidth: 1,
                                opacity: (!referralCode || isLoadingInfo) ? 0.5 : 1
                            }]}
                            onPress={handleShareCode}
                            disabled={!referralCode || isLoadingInfo}
                        >
                            <Ionicons 
                                name="share-outline" 
                                size={18} 
                                color={ThemedColor.primary} 
                            />
                            <ThemedText style={[styles.buttonText, { color: ThemedColor.primary }]}>
                                Share
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Unlocks Count */}
                <View style={styles.unlocksSection}>
                    <ThemedText type="default">
                        You have <ThemedText style={[styles.unlocksCount, { color: ThemedColor.primary }]}>
                            {isLoadingInfo ? "..." : unlocksRemaining} Unlock(s)
                        </ThemedText>
                    </ThemedText>
                </View>


                {/* Rewards List */}
                <View style={[styles.rewardsList, unlocksRemaining === 0 && styles.lockedOpacity]}>
                    {REWARDS_DATA.map((reward) => (
                        <View 
                            key={reward.id} 
                            style={[styles.rewardCard, { 
                                backgroundColor: ThemedColor.lightened,
                                shadowColor: ThemedColor.text
                            }]}
                        >
                            <View style={styles.rewardContent}>
                                <Ionicons 
                                    name={reward.icon} 
                                    size={32} 
                                    color={ThemedColor.primary} 
                                    style={styles.icon}
                                />
                                <View style={styles.rewardTextContainer}>
                                    <ThemedText type="defaultSemiBold" style={styles.rewardTitle}>
                                        {reward.title}
                                    </ThemedText>
                                    <ThemedText type="caption" style={styles.rewardDescription}>
                                        {reward.description}
                                    </ThemedText>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const useStyles = (ThemedColor: any) => {
    const base = 393;
    const scale = Dimensions.get("screen").width / base;

    return StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
        },
        backButton: {
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "flex-start",
        },
        backIcon: {
            fontSize: 24 * scale,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingBottom: 53,
            gap: 20,
        },
        titleSection: {
            gap: 8,
        },
        title: {
            fontSize: 32 * scale,
        },
        subtitle: {
            fontSize: 16 * scale,
            lineHeight: 22 * scale,
        },
        unlocksSection: {
            marginTop: 0,
        },
        unlocksCount: {
            fontWeight: "600",
            fontFamily: "Outfit",
        },
        referralSection: {
            gap: 12,
        },
        referralTitle: {
            fontSize: 16 * scale,
            marginBottom: 4,
        },
        codeContainer: {
            borderRadius: 8,
            padding: 16,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
        },
        codeText: {
            fontSize: 24 * scale,
            letterSpacing: 4,
            fontFamily: "Outfit",
        },
        buttonRow: {
            flexDirection: "row",
            gap: 8,
        },
        actionButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 8,
            gap: 6,
        },
        buttonText: {
            fontSize: 14 * scale,
            fontWeight: "600",
            fontFamily: "Outfit",
        },
        rewardsList: {
            gap: 12,
        },
        lockedOpacity: {
            opacity: 0.3,
        },
        rewardCard: {
            borderRadius: 12,
            padding: 20,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        rewardContent: {
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
        },
        icon: {
            flexShrink: 0,
        },
        rewardTextContainer: {
            flex: 1,
            gap: 8,
        },
        rewardTitle: {
            fontSize: 16 * scale,
            letterSpacing: -0.32,
        },
        rewardDescription: {
            fontSize: 14 * scale,
            lineHeight: 20 * scale,
        },
    });
};

