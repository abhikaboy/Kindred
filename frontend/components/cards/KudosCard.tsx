import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { AttachStep } from "react-native-spotlight-tour";
import { Sparkle, Confetti } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { useKudos } from "@/contexts/kudosContext";
import SimpleProgressBar from "../ui/SimpleProgressBar";

export const KudosCards: React.FC = () => {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { unreadEncouragementCount, unreadCongratulationCount, totalEncouragementCount, totalCongratulationCount } =
        useKudos();

    const hasUnreadEncouragements = unreadEncouragementCount > 0;
    const hasUnreadCongratulations = unreadCongratulationCount > 0;

    return (
        <AttachStep index={1} style={{ width: "100%" }}>
            <View style={styles.container}>
                <KudosCard
                    title="Encouragements"
                    unreadCount={unreadEncouragementCount}
                    totalCount={totalEncouragementCount}
                    maxCount={KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX}
                    type="encouragements"
                    icon={<Sparkle size={22} weight="regular" color="#9333EA" />}
                    onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}
                    hasUnread={hasUnreadEncouragements}
                    ThemedColor={ThemedColor}
                />
                <KudosCard
                    title="Congratulations"
                    unreadCount={unreadCongratulationCount}
                    totalCount={totalCongratulationCount}
                    maxCount={KUDOS_CONSTANTS.CONGRATULATIONS_MAX}
                    type="congratulations"
                    icon={<Confetti size={22} weight="fill" color={ThemedColor.primary} />}
                    onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}
                    hasUnread={hasUnreadCongratulations}
                    ThemedColor={ThemedColor}
                />
            </View>
        </AttachStep>
    );
};

interface KudosCardProps {
    title: string;
    unreadCount: number;
    totalCount: number;
    maxCount: number;
    type: "encouragements" | "congratulations";
    icon: React.ReactNode;
    onPress: () => void;
    hasUnread: boolean;
    ThemedColor: any;
}

const KudosCard: React.FC<KudosCardProps> = ({
    title,
    unreadCount,
    totalCount,
    maxCount,
    type,
    icon,
    onPress,
    hasUnread,
    ThemedColor,
}) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.card,
                {
                    backgroundColor: ThemedColor.lightenedCard,
                    borderColor: ThemedColor.tertiary,
                    boxShadow: ThemedColor.shadowSmall,
                },
            ]}>
            {hasUnread && <View style={[styles.unreadIndicator, { backgroundColor: ThemedColor.error }]} />}
            <View style={styles.cardContent}>
                <View style={styles.iconProgressRow}>
                    <View>{icon}</View>

                    <View style={styles.progressBarWrapper}>
                        <SimpleProgressBar current={totalCount} max={maxCount} height={6} animated={true} />
                    </View>
                </View>

                {unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: ThemedColor.error }]}>
                        <View>{icon}</View>

                        <ThemedText type="captionLight" style={styles.badgeText}>
                            {unreadCount}
                        </ThemedText>
                    </View>
                )}
                <View style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 2 }}>
                        <ThemedText type="caption">
                            {totalCount} / {maxCount}
                        </ThemedText>
                        <ThemedText type="caption" style={{ marginLeft: 7 }}>
                            {title}
                        </ThemedText>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    card: {
        flex: 1,
        padding: 5,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 90,
        borderWidth: 0.5,
        position: "relative",
    },
    cardContent: {
        alignItems: "center",
        gap: 8,
    },
    iconProgressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        width: "100%",
        paddingHorizontal: 8,
    },
    progressBarWrapper: {
        flex: 1,
    },
    unreadIndicator: {
        width: 10,
        height: 10,
        borderRadius: 10,
        position: "absolute",
        right: 8,
        top: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        minWidth: 24,
        alignItems: "center",
    },
    badgeText: {
        color: "white",
        fontSize: 12,
        fontWeight: "bold",
    },
});
