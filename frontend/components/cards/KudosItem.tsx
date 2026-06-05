import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import SpeechBubbleCard from "@/components/cards/SpeechBubbleCard";

interface KudosSender {
    name: string;
    picture: string;
    id: string;
}

interface KudosData {
    id: string;
    sender: KudosSender;
    message: string;
    scope?: string; // "task" or "profile"
    categoryName?: string;
    taskName?: string;
    timestamp: string;
    read: boolean;
    type?: string; // "message" or "image"
}

interface KudosItemProps {
    kudos: KudosData;
    formatTime: (timestamp: string) => string;
    visible?: boolean;
    index?: number;
    /** Optional content rendered in the bubble footer (e.g. an action button). */
    footerSlot?: React.ReactNode;
}

export default function KudosItem({ kudos, formatTime, visible = false, index = 0, footerSlot }: KudosItemProps) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const router = useRouter();

    const isImage = kudos.type === "image";
    const isProfileLevel = kudos.scope === "profile";

    const header = isProfileLevel ? (
        <ThemedText type="default" style={styles.categoryText}>
            Profile Encouragement 🎉
        </ThemedText>
    ) : (
        <>
            <ThemedText type="default" style={styles.categoryText} numberOfLines={1}>
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
            sender={kudos.sender}
            header={header}
            message={isImage ? undefined : kudos.message}
            imageUri={isImage ? kudos.message : undefined}
            timeLabel={formatTime(kudos.timestamp)}
            read={kudos.read}
            footerSlot={footerSlot}
            onAvatarPress={() => router.push(`/account/${kudos.sender.id}`)}
            visible={visible}
            index={index}
        />
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        categoryText: { color: ThemedColor.primary, fontSize: 15, fontWeight: "600", flexShrink: 1 },
        dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: ThemedColor.caption, flexShrink: 0 },
        taskName: { color: ThemedColor.primary, fontSize: 15, flexShrink: 1 },
    });
