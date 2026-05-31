import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCard as ForYouCardModel, ForYouCtaAction, ForYouIconKind } from "@/api/forYou";
import { ForYouCtaRow } from "./ForYouCta";

type Props = {
    card: ForYouCardModel;
    onAction?: (action: ForYouCtaAction) => void;
};

const ICON_FOR_KIND: Record<ForYouIconKind, keyof typeof Ionicons.glyphMap> = {
    kudos: "trophy",
    users: "people",
    ring: "ellipse",
    post: "create",
    comment: "chatbubble",
    blueprint: "grid",
};

export default function ForYouCard({ card, onAction }: Props) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const handleCardPress = () => {
        router.push(card.deepLink as never);
    };

    const iconName = ICON_FOR_KIND[card.iconKind];

    if (card.displayMode === "compact") {
        const inlineCta = card.ctas[0];
        return (
            <TouchableOpacity
                onPress={handleCardPress}
                activeOpacity={0.7}
                style={styles.compactContainer}
                accessibilityRole="button"
                accessibilityLabel={card.title}>
                <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + "20" }]}>
                    <Ionicons name={iconName} size={18} color={ThemedColor.primary} />
                </View>
                <ThemedText style={styles.compactTitle} numberOfLines={1}>
                    {card.title}
                </ThemedText>
                {inlineCta ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            if (onAction) onAction(inlineCta.action);
                            else if (inlineCta.action.type === "navigate") {
                                router.push(inlineCta.action.href as never);
                            }
                        }}
                        style={[styles.compactCta, { backgroundColor: ThemedColor.primary }]}
                        accessibilityRole="button">
                        <ThemedText style={styles.compactCtaLabel}>{inlineCta.label}</ThemedText>
                    </TouchableOpacity>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={ThemedColor.caption} />
            </TouchableOpacity>
        );
    }

    // Full layout
    return (
        <TouchableOpacity
            onPress={handleCardPress}
            activeOpacity={0.8}
            style={styles.fullContainer}
            accessibilityRole="button"
            accessibilityLabel={card.title}>
            <View style={styles.fullHeader}>
                <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + "20" }]}>
                    <Ionicons name={iconName} size={20} color={ThemedColor.primary} />
                </View>
                <View style={styles.fullTextBlock}>
                    <ThemedText style={styles.fullTitle}>{card.title}</ThemedText>
                    {card.body ? (
                        <ThemedText style={[styles.fullBody, { color: ThemedColor.caption }]}>
                            {card.body}
                        </ThemedText>
                    ) : null}
                </View>
            </View>
            <ForYouCtaRow ctas={card.ctas} onAction={onAction} />
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        iconCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        compactContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: ThemedColor.lightened,
        },
        compactTitle: {
            flex: 1,
            fontSize: 14,
            fontFamily: "Outfit",
            fontWeight: "500",
        },
        compactCta: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
        },
        compactCtaLabel: {
            color: "#fff",
            fontSize: 12,
            fontFamily: "Outfit",
            fontWeight: "500",
        },
        fullContainer: {
            padding: 16,
            borderRadius: 14,
            backgroundColor: ThemedColor.lightened,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
        },
        fullHeader: {
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
        },
        fullTextBlock: {
            flex: 1,
            gap: 4,
        },
        fullTitle: {
            fontSize: 16,
            fontFamily: "Outfit",
            fontWeight: "600",
        },
        fullBody: {
            fontSize: 14,
            fontFamily: "Outfit",
            lineHeight: 19,
        },
    });
