import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "@/components/profile/PreviewIcon";
import CachedImage from "@/components/CachedImage";
import { getNotificationTimeLabel } from "./notificationTime";

type Props = {
    actorName: string;
    actorIcon: string;
    actorId: string;
    /** Full headline. Actor name is rendered separately and bolded; this is the trailing phrase. */
    headlineTrailing: string;
    timestamp: number;
    /** Optional quoted/embedded content shown below the header — comment text, message excerpt. */
    contentBlock?: React.ReactNode;
    /** Optional right-side thumbnail (post image, friend avatar). */
    thumbnailUrl?: string;
    /** Primary action label rendered as an outlined button. */
    ctaLabel: string;
    onCtaPress: () => void;
    /** Tapping anywhere outside the avatar/CTA fires this. Defaults to onCtaPress. */
    onCardPress?: () => void;
};

export default function NotificationCard({
    actorName,
    actorIcon,
    actorId,
    headlineTrailing,
    timestamp,
    contentBlock,
    thumbnailUrl,
    ctaLabel,
    onCtaPress,
    onCardPress,
}: Props) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const handleBodyPress = onCardPress ?? onCtaPress;

    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.85}
            onPress={handleBodyPress}
            accessibilityRole="button">
            <View style={styles.headerRow}>
                <TouchableOpacity
                    onPress={() => router.push(`/account/${actorId}` as never)}
                    activeOpacity={0.7}>
                    <PreviewIcon size="smallMedium" icon={actorIcon} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <ThemedText type="defaultSemiBold" style={styles.headline}>
                        <ThemedText type="defaultSemiBold" style={styles.headlineActor}>
                            {actorName}
                        </ThemedText>
                        <ThemedText type="default" style={styles.headlineTrailing}>
                            {" "}
                            {headlineTrailing}
                        </ThemedText>
                    </ThemedText>
                </View>
                <ThemedText type="caption" style={styles.timestamp}>
                    {getNotificationTimeLabel(timestamp)}
                </ThemedText>
            </View>

            {contentBlock || thumbnailUrl ? (
                <View style={styles.contentRow}>
                    {contentBlock ? <View style={styles.contentBody}>{contentBlock}</View> : null}
                    {thumbnailUrl ? (
                        <CachedImage
                            source={{ uri: thumbnailUrl }}
                            style={styles.thumbnail}
                            variant="thumbnail"
                            cachePolicy="memory-disk"
                        />
                    ) : null}
                </View>
            ) : null}

            <TouchableOpacity
                onPress={(e) => {
                    e.stopPropagation();
                    onCtaPress();
                }}
                activeOpacity={0.8}
                style={[styles.ctaButton, { borderColor: ThemedColor.primary }]}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}>
                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary, fontSize: 14 }}>
                    {ctaLabel}
                </ThemedText>
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            padding: 14,
            borderRadius: 14,
            backgroundColor: ThemedColor.lightenedCard,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            gap: 12,
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
        },
        headerText: {
            flex: 1,
            marginRight: 4,
        },
        headline: {
            fontSize: 15,
            lineHeight: 20,
        },
        headlineActor: {
            fontSize: 15,
            lineHeight: 20,
        },
        headlineTrailing: {
            fontSize: 15,
            lineHeight: 20,
        },
        timestamp: {
            marginLeft: "auto",
            fontSize: 12,
        },
        contentRow: {
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
        },
        contentBody: {
            flex: 1,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 10,
            padding: 10,
        },
        thumbnail: {
            width: 64,
            height: 64,
            borderRadius: 8,
        },
        ctaButton: {
            alignSelf: "flex-start",
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 10,
            borderWidth: 1,
        },
    });
