import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCardType, ForYouCtaAction, ForYouSection as ForYouSectionModel } from "@/api/forYou";
import ForYouCard from "./ForYouCard";

type Props = {
    section: ForYouSectionModel;
    onAction?: (action: ForYouCtaAction, cardType: ForYouCardType) => void;
};

export default function ForYouSection({ section, onAction }: Props) {
    const ThemedColor = useThemeColor();
    // Defensive: older backend builds could serialize an empty card list as
    // `null` instead of `[]`. Treat null/undefined as empty.
    const cards = section.cards ?? [];
    const isEmpty = cards.length === 0;

    return (
        <View style={styles.container}>
            <ThemedText type="defaultSemiBold" style={styles.heading}>
                {section.title}
            </ThemedText>
            {isEmpty ? (
                <View
                    style={[
                        styles.emptyState,
                        { backgroundColor: ThemedColor.tertiary + "30" },
                    ]}>
                    <ThemedText style={{ color: ThemedColor.caption }}>
                        {section.id === "catch_up"
                            ? "You're all caught up \u{1F44B}"
                            : "Nothing suggested right now."}
                    </ThemedText>
                </View>
            ) : (
                <View style={styles.cardList}>
                    {cards.map((card, index) => (
                        <ForYouCard
                            key={card.id}
                            card={card}
                            onAction={onAction}
                            elevated={section.id === "catch_up"}
                            // Only the lead card in "Suggested for you" gets a primary CTA;
                            // the rest demote so there's a single visual focal point per section.
                            demoteCtas={section.id === "suggested" && index > 0}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    heading: {
        marginBottom: 12,
    },
    cardList: {
        gap: 10,
    },
    emptyState: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
    },
});
