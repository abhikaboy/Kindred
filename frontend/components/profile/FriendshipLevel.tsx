import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ChatCircle, Heart, Info, PaperPlaneTilt } from "phosphor-react-native";
import { FRIENDSHIP_ACTIONS, friendshipLevel } from "@shared/friendship";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "@/components/modals/DefaultModal";
import SimpleProgressBar from "@/components/ui/SimpleProgressBar";
import { useThemeColor } from "@/hooks/useThemeColor";

// ponytail: icons map to FRIENDSHIP_ACTIONS positionally rather than adding an icon field upstream.
const ACTION_ICONS = [PaperPlaneTilt, ChatCircle, Heart];

type SheetProps = { visible: boolean; setVisible: (visible: boolean) => void };

function FriendshipInfoSheet({ visible, setVisible }: SheetProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    return (
        <DefaultModal visible={visible} setVisible={setVisible} enableDynamicSizing>
            <View style={styles.sheet}>
                <ThemedText type="subtitle">Friendship score</ThemedText>
                <ThemedText type="caption">
                    Your score grows every time you show up for each other. Each level takes a little more than the one
                    before it.
                </ThemedText>
                {FRIENDSHIP_ACTIONS.map((action, index) => {
                    const Icon = ACTION_ICONS[index] ?? Heart;
                    return (
                        <View key={action.label} style={styles.actionCard}>
                            <View style={styles.iconCircle}>
                                <Icon size={20} color={ThemedColor.primary} weight="fill" />
                            </View>
                            <View style={styles.actionContent}>
                                <ThemedText type="defaultSemiBold">{action.label}</ThemedText>
                                <ThemedText type="caption">+{action.points} points</ThemedText>
                            </View>
                        </View>
                    );
                })}
            </View>
        </DefaultModal>
    );
}

export default function FriendshipLevel({ score }: { score: number }) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [infoVisible, setInfoVisible] = useState(false);

    const level = friendshipLevel(score);
    const next = level.next;

    return (
        <>
            <TouchableOpacity style={styles.card} activeOpacity={0.6} onPress={() => setInfoVisible(true)}>
                <View style={styles.headerRow}>
                    <View style={styles.nameRow}>
                        <ThemedText type="defaultSemiBold">{level.name}</ThemedText>
                        <Info size={14} color={ThemedColor.caption} />
                    </View>
                    <ThemedText type="caption">{score} points</ThemedText>
                </View>
                <SimpleProgressBar
                    current={next === null ? 1 : score - level.floor}
                    max={next === null ? 1 : next - level.floor}
                    height={4}
                />
                {next !== null && (
                    <ThemedText type="caption">
                        {next - score} to {friendshipLevel(next).name}
                    </ThemedText>
                )}
            </TouchableOpacity>
            <FriendshipInfoSheet visible={infoVisible} setVisible={setInfoVisible} />
        </>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        card: {
            width: "100%",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            backgroundColor: ThemedColor.lightenedCard,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },
        nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        sheet: { gap: 12, paddingBottom: 16 },
        actionCard: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: 12,
            backgroundColor: ThemedColor.lightenedCard,
        },
        actionContent: { flex: 1 },
        iconCircle: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ThemedColor.primary + "20",
        },
    });
