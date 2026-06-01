import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCard as ForYouCardModel, ForYouCardType, ForYouCtaAction, ForYouIconKind } from "@/api/forYou";
import { ForYouCtaRow } from "./ForYouCta";

type Props = {
    card: ForYouCardModel;
    onAction?: (action: ForYouCtaAction, cardType: ForYouCardType) => void;
    /** Adds a subtle drop shadow to the card. Used in the Catch up section to lift it off the page. */
    elevated?: boolean;
    /** When true, every CTA on the card renders as secondary. Used for non-lead cards in Suggested for you so there is only one primary CTA per section. */
    demoteCtas?: boolean;
};

const ICON_FOR_KIND: Record<ForYouIconKind, keyof typeof Ionicons.glyphMap> = {
    kudos: "trophy",
    users: "people",
    ring: "ellipse",
    post: "create",
    comment: "chatbubble",
    blueprint: "grid",
};

export default function ForYouCard({ card, onAction, elevated, demoteCtas }: Props) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const ctas = demoteCtas
        ? card.ctas.map((c) => ({ ...c, kind: "secondary" as const }))
        : card.ctas;

    const dispatchAction = (action: ForYouCtaAction) => {
        if (onAction) {
            onAction(action, card.type);
        } else if (action.type === "navigate" && action.href) {
            router.push(action.href as never);
        }
    };

    const handleCardPress = () => {
        dispatchAction({ type: "navigate", href: card.deepLink });
    };

    const iconName = ICON_FOR_KIND[card.iconKind];

    if (card.displayMode === "compact") {
        const inlineCta = ctas[0];
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
                <ThemedText type="defaultSemiBold" style={styles.compactTitle} numberOfLines={1}>
                    {card.title}
                </ThemedText>
                {inlineCta ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            dispatchAction(inlineCta.action);
                        }}
                        style={[styles.compactCta, { backgroundColor: ThemedColor.primary }]}
                        accessibilityRole="button">
                        <ThemedText type="defaultSemiBold" style={styles.compactCtaLabel}>
                            {inlineCta.label}
                        </ThemedText>
                    </TouchableOpacity>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={ThemedColor.caption} />
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={handleCardPress}
            activeOpacity={0.8}
            style={[styles.fullContainer, elevated && styles.elevation]}
            accessibilityRole="button"
            accessibilityLabel={card.title}>
            <View style={styles.fullHeader}>
                <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + "20" }]}>
                    <Ionicons name={iconName} size={20} color={ThemedColor.primary} />
                </View>
                <View style={styles.fullTextBlock}>
                    <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
                    {card.body ? <ThemedText type="caption">{card.body}</ThemedText> : null}
                </View>
            </View>
            <ForYouCtaRow ctas={ctas} onAction={dispatchAction} />
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
        },
        compactCta: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
        },
        compactCtaLabel: {
            color: "#fff",
            fontSize: 13,
        },
        fullContainer: {
            padding: 16,
            borderRadius: 14,
            backgroundColor: ThemedColor.lightened,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
        },
        elevation: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
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
    });
