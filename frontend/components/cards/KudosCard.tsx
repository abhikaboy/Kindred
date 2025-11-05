import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { AttachStep } from "react-native-spotlight-tour";
import { Fire, Confetti } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface KudosCardsProps {
    encouragementCount: number;
    congratulationCount: number;
    ThemedColor: any;
}

const ThemedColor = useThemeColor();

export const KudosCards: React.FC<KudosCardsProps> = ({ encouragementCount, congratulationCount, ThemedColor }) => {
    const router = useRouter();

    const hasUnreadEncouragements = encouragementCount > 0;
    const hasUnreadCongratulations = congratulationCount > 0;

    return (
        <AttachStep index={1} style={{ width: "100%" }}>
            <View style={styles.container}>
                <KudosCard
                    title="Encouragements"
                    count={encouragementCount}
                    icon={<Fire size={24} weight="fill" color={ThemedColor.primary} />}
                    onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}
                    hasUnread={hasUnreadEncouragements}
                    ThemedColor={ThemedColor}
                />
                <KudosCard
                    title="Congratulations"
                    count={congratulationCount}
                    icon={<Confetti size={24} weight="fill" color={ThemedColor.primary} />}
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
    count: number;
    icon: React.ReactNode;
    onPress: () => void;
    hasUnread: boolean;
    ThemedColor: any;
}

const KudosCard: React.FC<KudosCardProps> = ({ title, count, icon, onPress, hasUnread, ThemedColor }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.card,
                {
                    backgroundColor: ThemedColor.lightenedCard,
                },
            ]}>
            {hasUnread && <View style={[styles.unreadIndicator, { backgroundColor: ThemedColor.error }]} />}
            <View
                style={{
                    alignItems: "center",
                    gap: 4,
                }}>
                <View>{icon}</View>

                <ThemedText type="title">{count}</ThemedText>

                <ThemedText type="default" numberOfLines={1}>
                    {title}
                </ThemedText>
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
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
        borderWidth: 1,
        borderColor: ThemedColor.tertiary,
        position: "relative",
        boxShadow: ThemedColor.shadowSmall,
    },
    unreadIndicator: {
        width: 10,
        height: 10,
        borderRadius: 10,
        position: "absolute",
        right: 8,
        top: 8,
    },
});
