import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Confetti } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    /** overlay: white pill floating on media; primary: filled pill in the footer row */
    variant: "overlay" | "primary";
    onPress?: () => void;
};

const SendKudosPill = ({ variant, onPress }: Props) => {
    const ThemedColor = useThemeColor();
    const isOverlay = variant === "overlay";
    // lightenedCard carries alpha; the pill floats over media so it must stay opaque
    const bg = isOverlay ? ThemedColor.lightenedCard.slice(0, 7) : ThemedColor.primary;
    const fg = isOverlay ? ThemedColor.primary : ThemedColor.buttonText;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[styles.pill, { backgroundColor: bg }, isOverlay && styles.shadow]}
        >
            <Confetti size={18} weight="fill" color={fg} />
            <ThemedText type="defaultSemiBold" style={{ color: fg, fontSize: 14 }}>
                Send Kudos
            </ThemedText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
});

export default SendKudosPill;
