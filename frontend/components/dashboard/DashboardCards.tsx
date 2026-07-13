import { View, Dimensions, Modal } from "react-native";
import React, { useState } from "react";
import DashboardCard from "../cards/DashboardCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { Bird, Calendar, HandSwipeRight, Microphone } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { VoiceInputOverlay } from "@/components/ui/fab/VoiceInputOverlay";

const DashboardCards = () => {
    const ThemedColor = useThemeColor();
    const [voiceOverlayVisible, setVoiceOverlayVisible] = useState(false);

    const cards = [
        {
            title: "Today",
            icon: <Bird size={22} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/daily",
                    params: { workspace: "Daily" },
                });
            },
        },
        {
            title: "Calendar",
            icon: <Calendar size={22} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/daily",
                    params: { workspace: "Calendar" },
                });
            },
        },
        {
            title: "Task Review",
            icon: <HandSwipeRight size={22} weight="light" color={ThemedColor.primary} />,
            onPress: () => {
                router.push({
                    pathname: "/(logged-in)/(tabs)/(task)/review",
                    params: { workspace: "Review" },
                });
            },
        },
        {
            title: "Voice Dump",
            icon: <Microphone size={22} weight="light" color={ThemedColor.primary} />,
            badge: "AI",
            onPress: () => setVoiceOverlayVisible(true),
        },
    ];

    const cardWidth = (Dimensions.get("window").width - HORIZONTAL_PADDING * 2 - 12) / 2;

    return (
        <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingRight: HORIZONTAL_PADDING }}>
                {cards.map((card) => (
                    <DashboardCard
                        key={card.title}
                        title={card.title}
                        icon={card.icon}
                        onPress={card.onPress}
                        badge={card.badge}
                        style={{ width: cardWidth }}
                    />
                ))}
            </View>

            {voiceOverlayVisible && (
                <Modal transparent animationType="none" statusBarTranslucent>
                    <VoiceInputOverlay onClose={() => setVoiceOverlayVisible(false)} />
                </Modal>
            )}
        </>
    );
};

export default DashboardCards;
