import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle } from "react-native";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { getNotificationTimeLabel } from "@/components/UserInfo/notificationTime";

type Props = {
    time: number;
    icon: string;
    userId?: string;
    sentence: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    onPress?: () => void;
};

const SENTENCE_SIZE = { fontSize: 18, lineHeight: 26 } as const;

type SpanProps = { children: React.ReactNode; style?: StyleProp<TextStyle> };

// Muted sentence span — the Venmo-style hero sizing lives here.
export const SentenceText = ({ children, style }: SpanProps) => {
    const ThemedColor = useThemeColor();
    return (
        <ThemedText type="default" style={[SENTENCE_SIZE, { color: ThemedColor.caption }, style]}>
            {children}
        </ThemedText>
    );
};

// Bold span for names and task titles.
export const SentenceBold = ({ children, style }: SpanProps) => (
    <ThemedText type="defaultSemiBold" style={[SENTENCE_SIZE, style]}>
        {children}
    </ThemedText>
);

// Regular-weight span in the primary text color — quoted comment/kudos bodies.
export const SentenceFocus = ({ children, style }: SpanProps) => (
    <ThemedText type="default" style={[SENTENCE_SIZE, style]}>
        {children}
    </ThemedText>
);

// Avatar embedded in the sentence text flow. Core RN Image, not CachedImage —
// expo-image doesn't render as an inline text attachment on Fabric.
const InlineAvatar = ({ icon }: { icon: string }) => (
    <Image source={{ uri: icon }} style={styles.inlineAvatar} />
);

type ActionCircleProps = {
    label: string;
    onPress: () => void;
    caption?: string;
    children: React.ReactNode;
    testID?: string;
};

// Venmo-style action button: a circle, or a labeled pill when caption is given.
export const ActionCircle = ({ label, onPress, caption, children, testID }: ActionCircleProps) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            testID={testID}
            style={[
                caption ? styles.actionPill : styles.actionCircle,
                // lightened is invisible against the card fill — background + border reads as a shape
                { backgroundColor: ThemedColor.background, borderWidth: 1, borderColor: ThemedColor.tertiary },
            ]}>
            {children}
            {caption ? (
                <ThemedText type="caption" style={{ color: ThemedColor.text }}>
                    {caption}
                </ThemedText>
            ) : null}
        </TouchableOpacity>
    );
};

// Bottom-left row of ActionCircles for the card's footer slot.
export const FooterRow = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.footerRow}>{children}</View>
);

const NotificationCard = ({ time, icon, userId, sentence, children, footer, onPress }: Props) => {
    const ThemedColor = useThemeColor();
    const timeLabel = getNotificationTimeLabel(time);
    // Avatar lives inside the text flow now, so profile routing falls back to the card press.
    const handlePress = onPress ?? (userId ? () => router.push(`/account/${userId}`) : undefined);

    const cardContent = (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: ThemedColor.lightenedCard,
                    borderColor: ThemedColor.tertiary,
                },
            ]}>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                {timeLabel}
            </ThemedText>
            <Text style={styles.sentence}>
                <InlineAvatar icon={icon} />
                <SentenceText> </SentenceText>
                {sentence}
            </Text>
            {children}
            {footer}
        </View>
    );

    if (handlePress) {
        return (
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
                {cardContent}
            </TouchableOpacity>
        );
    }

    return cardContent;
};

export default NotificationCard;

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
    },
    sentence: {
        ...SENTENCE_SIZE,
        textAlign: "left",
    },
    inlineAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        // pulls the baseline-anchored image down so it centers on the 26px line
        marginBottom: -6,
    },
    actionCircle: {
        width: 44,
        height: 44,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    actionPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 44,
        borderRadius: 999,
        paddingHorizontal: 16,
    },
    footerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
});
