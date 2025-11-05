import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import BasicCard from "@/components/cards/BasicCard";
import { AttachStep } from "react-native-spotlight-tour";

interface KudosCardsProps {
    encouragementCount: number;
    congratulationCount: number;
    ThemedColor: any;
}

export const KudosCards: React.FC<KudosCardsProps> = ({ encouragementCount, congratulationCount, ThemedColor }) => {
    const router = useRouter();

    // Show unread items at the top
    const hasUnreadEncouragements = encouragementCount > 0;
    const hasUnreadCongratulations = congratulationCount > 0;
    const hasAnyUnread = hasUnreadEncouragements || hasUnreadCongratulations;

    // If there are unread items, show them at the top
    if (hasAnyUnread) {
        return (
            <AttachStep index={1} style={{ width: "100%" }}>
                <View style={{ width: "100%", gap: 16 }}>
                    {hasUnreadEncouragements && (
                        <KudosCard
                            title="Encouragements"
                            count={encouragementCount}
                            onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}
                            hasUnread={true}
                            ThemedColor={ThemedColor}
                        />
                    )}
                    {hasUnreadCongratulations && (
                        <KudosCard
                            title="Congratulations"
                            count={congratulationCount}
                            onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}
                            hasUnread={true}
                            ThemedColor={ThemedColor}
                        />
                    )}
                </View>
            </AttachStep>
        );
    }

    // If no unread items, show them in the Kudos section
    return (
        <AttachStep index={1} style={{ width: "100%", gap: 16 }}>
            <View style={{ width: "100%", gap: 16 }}>
                <ThemedText type="subtitle">Kudos</ThemedText>
                <View style={{ width: "100%", gap: 12 }}>
                    <KudosCard
                        title="Encouragements"
                        count={encouragementCount}
                        onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/encouragements")}
                        hasUnread={false}
                        ThemedColor={ThemedColor}
                    />
                    <KudosCard
                        title="Congratulations"
                        count={congratulationCount}
                        onPress={() => router.navigate("/(logged-in)/(tabs)/(task)/congratulations")}
                        hasUnread={false}
                        ThemedColor={ThemedColor}
                    />
                </View>
            </View>
        </AttachStep>
    );
};

interface KudosCardProps {
    title: string;
    count: number;
    onPress: () => void;
    hasUnread: boolean;
    ThemedColor: any;
}

const KudosCard: React.FC<KudosCardProps> = ({ title, count, onPress, hasUnread, ThemedColor }) => {
    return (
        <TouchableOpacity onPress={onPress}>
            <BasicCard>
                {hasUnread && (
                    <View
                        style={{
                            width: 12,
                            height: 12,
                            backgroundColor: ThemedColor.error,
                            borderRadius: 12,
                            position: "absolute",
                            right: 0,
                            top: 0,
                        }}
                    />
                )}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}>
                    <ThemedText type="default">{title}</ThemedText>
                    <ThemedText type="default">{count}</ThemedText>
                </View>
            </BasicCard>
        </TouchableOpacity>
    );
};
