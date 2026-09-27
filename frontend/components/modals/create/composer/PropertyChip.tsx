import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import type { IconProps } from "phosphor-react-native";
import { Sparkle, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { STAGE } from "@/components/capture/CaptureStage";

/**
 * - empty: nothing set; opens the property
 * - suggested: a guess from the title; tap accepts it
 * - set: holds a value; tap edits, the x clears it
 */
export type ChipState = "empty" | "suggested" | "set";

/**
 * core: the everyday properties, always a labeled button.
 * extra: the rest, a quiet bare icon until it holds a value.
 */
export type ChipTier = "core" | "extra";

type Props = {
    Icon: React.ComponentType<IconProps>;
    state: ChipState;
    tier: ChipTier;
    label?: string;
    /** Tints the icon, e.g. the priority color. */
    iconColor?: string;
    /** Its panel is the one open below. */
    active?: boolean;
    onPress: () => void;
    onClear?: () => void;
    accessibilityLabel: string;
};

const PropertyChip = ({ Icon, state, tier, label, iconColor, active, onPress, onClear, accessibilityLabel }: Props) => {
    const ThemedColor = useThemeColor();
    const set = state === "set";
    const suggested = state === "suggested";
    const bare = tier === "extra" && state === "empty";
    // The chip whose panel is open reads as selected: solid white
    const ink = active ? STAGE.onSelected : set || suggested ? STAGE.text : STAGE.muted;

    const surface = bare
        ? styles.bare
        : [
              styles.button,
              { backgroundColor: active ? STAGE.selected : set ? STAGE.fillRaised : STAGE.fill },
              suggested && { borderColor: STAGE.faint, borderStyle: "dashed" as const },
          ];

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: !!active }}
            accessibilityLabel={suggested ? `Use suggested ${accessibilityLabel}: ${label}` : accessibilityLabel}
            style={[surface, bare && active && { backgroundColor: STAGE.selected }]}>
            <Icon size={bare ? 20 : 18} color={active ? STAGE.onSelected : (iconColor ?? ink)} weight={set ? "fill" : "regular"} />
            {!bare && !!label && (
                <ThemedText type="lightBody" style={[styles.label, { color: ink }]}>
                    {label}
                </ThemedText>
            )}
            {suggested && <Sparkle size={12} color={ThemedColor.primary} weight="fill" />}
            {set && onClear && !active && (
                <TouchableOpacity
                    onPress={onClear}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${accessibilityLabel}`}>
                    <X size={12} color={STAGE.muted} weight="bold" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

export default PropertyChip;

const styles = StyleSheet.create({
    // Flat fill, 12 radius; the border only shows for suggestions
    button: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "transparent",
    },
    bare: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 40,
    },
    label: { fontSize: 15 },
});
