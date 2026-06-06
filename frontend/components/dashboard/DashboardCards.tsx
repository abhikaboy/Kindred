import { View, ScrollView } from "react-native";
import React from "react";
import DashboardCard from "../cards/DashboardCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { Bird, Calendar, HandSwipeRight, PencilLine } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const DashboardCards = () => {
    const ThemedColor = useThemeColor();

    const cards = [
        {
            title: "Daily View",
            icon: <Bird size={28} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/daily",
                    params: { workspace: "Daily" },
                });
            },
        },
        {
            title: "Calendar",
            icon: <Calendar size={28} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/daily",
                    params: { workspace: "Calendar" },
                });
            },
        },
        {
            title: "Task Review",
            icon: <HandSwipeRight size={28} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/review",
                    params: { workspace: "Review" },
                });
            },
        },
        {
            title: "Text Dump",
            icon: <PencilLine size={28} weight="light" color={ThemedColor.primary} />,
            badge: "AI",
            onPress: () => {
                router.push("/text-dump");
            },
        },
    ];

    // Split cards into two rows
    const topRowCards = cards.filter((_, index) => index % 2 === 0);
    const bottomRowCards = cards.filter((_, index) => index % 2 === 1);

    return (
        <View style={{ flexDirection: "column", gap: 12, width: "100%"}}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    gap: 12,
                    paddingLeft: HORIZONTAL_PADDING,
                    paddingRight: HORIZONTAL_PADDING,
                }}
                style={{
                    marginLeft: -HORIZONTAL_PADDING,
                    marginRight: 0,
                }}
                bounces={false}
                decelerationRate={0.9988}
                directionalLockEnabled={true}
                canCancelContentTouches={true}
                scrollEventThrottle={16}
                alwaysBounceHorizontal={false}
                nestedScrollEnabled={true}>
                <View style={{ flexDirection: "column", gap: 12 }}>
                    {/* Top Row */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        {topRowCards.map((card) => (
                            <DashboardCard
                                key={card.title}
                                title={card.title}
                                icon={card.icon}
                                onPress={card.onPress}
                                badge={card.badge}
                            />
                        ))}
                    </View>

                    {/* Bottom Row */}
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        {bottomRowCards.map((card) => (
                            <DashboardCard
                                key={card.title}
                                title={card.title}
                                icon={card.icon}
                                onPress={card.onPress}
                                badge={card.badge}
                            />
                        ))}
                    </View>
                </View>
            </ScrollView>

        </View>
    );
};

export default DashboardCards;
