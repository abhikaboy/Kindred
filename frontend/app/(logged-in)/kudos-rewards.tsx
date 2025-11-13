import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, useColorScheme } from "react-native";
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

export default function KudosRewards() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const { user } = useAuth();

    // Get sent counts from user's kudosRewards for progress tracking
    const encouragementsProgress = user?.kudosRewards?.encouragements || 0;
    const congratulationsProgress = user?.kudosRewards?.congratulations || 0;

    const styles = createStyles(ThemedColor, insets);

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

                {/* Rewards List */}
                <View style={styles.rewardsList}>
                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            2 VOICE CREDITS
                        </ThemedText>
                    </BasicCard>

                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            1 CIRCLES
                        </ThemedText>
                    </BasicCard>

                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            1 BLUEPRINT CREDIT
                        </ThemedText>
                    </BasicCard>

                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            UNLIMITED KUDOS (24 hours)
                        </ThemedText>
                    </BasicCard>

                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            INTEGRATIONS
                        </ThemedText>
                    </BasicCard>

                    <BasicCard>
                        <ThemedText type="default" style={styles.rewardText}>
                            PRODUCTIVITY ANALYTIC REPORT
                        </ThemedText>
                    </BasicCard>
                </View>
            </ScrollView>
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
            width: "100%",
            aspectRatio: 1,
            marginVertical: 16,
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
            gap: 12,
            paddingBottom: 24,
        },
        rewardText: {
            fontSize: 16,
            color: ThemedColor.text,
        },
    });
