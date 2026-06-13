import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";
import type { Encouragement, Congratulation } from "@/contexts/kudosContext";

type SentKudos = Encouragement | Congratulation;

interface SentKudosItemProps {
    kudos: SentKudos;
    formatTime: (timestamp: string) => string;
    visible?: boolean;
    index?: number;
}

interface SentReactionStatusProps {
    reaction?: string;
}

/** The receiver's reaction once it lands, or a subtle pending ring until then. */
export function SentReactionStatus({ reaction }: SentReactionStatusProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);

    if (reaction) {
        return (
            <ThemedText testID="sent-reaction" style={styles.reactionEmoji}>
                {reaction}
            </ThemedText>
        );
    }
    return <View testID="pending-indicator" style={styles.pendingRing} />;
}

export default function SentKudosItem({ kudos, formatTime, visible = false, index = 0 }: SentKudosItemProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const router = useRouter();

    const isImage = kudos.type === "image";
    const isProfileLevel = "scope" in kudos && kudos.scope === "profile";
    const receiver = kudos.receiverInfo ?? { name: "A friend", picture: "", id: "" };

    // The avatar is the recipient, so the name reads "To <receiver>"; the
    // category·task sits beneath it as context (profile kudos have none).
    const context = isProfileLevel ? undefined : (
        <>
            <ThemedText type="defaultSemiBold" style={styles.categoryText} numberOfLines={1}>
                {kudos.categoryName}
            </ThemedText>
            <View style={styles.dot} />
            <ThemedText type="default" style={styles.taskName} numberOfLines={1}>
                {kudos.taskName}
            </ThemedText>
        </>
    );

    return (
        <SpeechBubbleCard
            sender={receiver}
            namePrefix="To"
            context={context}
            message={isImage ? undefined : kudos.message}
            imageUri={isImage ? kudos.message : undefined}
            timeLabel={formatTime(kudos.timestamp)}
            read
            footerSlot={
                <View style={styles.statusRow}>
                    <SentReactionStatus reaction={kudos.reaction} />
                </View>
            }
            onAvatarPress={receiver.id ? () => router.push(`/account/${receiver.id}`) : undefined}
            visible={visible}
            index={index}
        />
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        categoryText: { color: ThemedColor.text, fontSize: 15, flexShrink: 1 },
        dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: ThemedColor.caption, flexShrink: 0 },
        taskName: { color: ThemedColor.text, fontSize: 15, flexShrink: 1 },
        statusRow: { flexDirection: "row", justifyContent: "flex-end" },
        reactionEmoji: { fontSize: 18 },
        pendingRing: {
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: ThemedColor.caption,
            opacity: 0.5,
        },
    });
