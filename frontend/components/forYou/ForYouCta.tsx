import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ForYouCta as ForYouCtaModel, ForYouCtaAction } from "@/api/forYou";

type Props = {
    cta: ForYouCtaModel;
    onAction?: (action: ForYouCtaAction) => void;
};

export default function ForYouCta({ cta, onAction }: Props) {
    const ThemedColor = useThemeColor();

    const handlePress = () => {
        if (onAction) {
            onAction(cta.action);
            return;
        }
        if (cta.action.type === "navigate") {
            router.push(cta.action.href as never);
        } else {
            console.log("[ForYouCta] stub action:", cta.action);
        }
    };

    const isPrimary = cta.kind === "primary";
    const bg = isPrimary ? ThemedColor.primary : "transparent";
    const borderColor = isPrimary ? ThemedColor.primary : ThemedColor.tertiary;
    const textColor = isPrimary ? "#fff" : ThemedColor.primary;

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.8}
            style={[styles.button, { backgroundColor: bg, borderColor }]}
            accessibilityRole="button">
            <ThemedText type="defaultSemiBold" style={{ color: textColor, fontSize: 14 }}>
                {cta.label}
            </ThemedText>
        </TouchableOpacity>
    );
}

export function ForYouCtaRow({
    ctas,
    onAction,
}: {
    ctas: ForYouCtaModel[];
    onAction?: (action: ForYouCtaAction) => void;
}) {
    if (ctas.length === 0) return null;
    return (
        <View style={styles.row}>
            {ctas.map((cta, i) => (
                <View key={`${cta.label}-${i}`} style={styles.cell}>
                    <ForYouCta cta={cta} onAction={onAction} />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    row: {
        flexDirection: "row",
        gap: 8,
        marginTop: 12,
    },
    cell: {
        flex: 1,
    },
});
