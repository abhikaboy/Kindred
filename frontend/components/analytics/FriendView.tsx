import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useKudos } from "@/contexts/kudosContext";
import { DetailHeader } from "./DetailHeader";
import { WidgetCard } from "./WidgetCard";
import { StatCards } from "./StatCards";
import EncourageModal from "@/components/modals/EncourageModal";

interface FriendViewProps {
    userId: string;
    displayName?: string;
    handle?: string;
}

/**
 * Privacy-safe minimal friend view: no analytics on the friend, just the Kudos
 * exchanged between the two of you plus a way to cheer them on.
 */
export function FriendView({ userId, displayName, handle }: FriendViewProps) {
    const ThemedColor = useThemeColor() as any;
    const insets = useSafeAreaInsets();
    const styles = stylesheet(ThemedColor);
    const { encouragements, sentEncouragements } = useKudos();
    const [encourageVisible, setEncourageVisible] = useState(false);

    const fromThem = useMemo(
        () => (encouragements ?? []).filter((e: any) => e.sender?.id === userId).length,
        [encouragements, userId],
    );
    const toThem = useMemo(
        () => (sentEncouragements ?? []).filter((e: any) => e.receiverInfo?.id === userId).length,
        [sentEncouragements, userId],
    );

    const name = displayName || "This friend";
    const initial = (name.trim()[0] ?? "?").toUpperCase();

    return (
        <View style={{ flex: 1, backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }}>
            <DetailHeader title={name} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 110 }}>
                <View style={styles.profile}>
                    <View style={styles.avatar}>
                        <ThemedText type="fancyFrauncesSubheading" style={{ color: ThemedColor.buttonText }}>
                            {initial}
                        </ThemedText>
                    </View>
                    <ThemedText type="fancyFrauncesSubheading">{name}</ThemedText>
                    {handle ? <ThemedText type="caption">{handle}</ThemedText> : null}
                </View>

                <StatCards
                    items={[
                        { label: "Kudos from them", value: String(fromThem) },
                        { label: "Kudos to them", value: String(toThem) },
                    ]}
                />

                <WidgetCard title="Cheer them on">
                    <ThemedText type="caption">Send a little encouragement to keep them going.</ThemedText>
                    <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => setEncourageVisible(true)}>
                        <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.buttonText }}>
                            Send encouragement
                        </ThemedText>
                    </TouchableOpacity>
                </WidgetCard>
            </ScrollView>

            <EncourageModal
                visible={encourageVisible}
                setVisible={setEncourageVisible}
                isProfileLevel
                encouragementConfig={{ receiverId: userId, categoryName: "", userHandle: handle }}
            />
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        profile: {
            alignItems: "center",
            gap: 6,
            marginVertical: 20,
        },
        avatar: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: ThemedColor.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
        },
        button: {
            backgroundColor: ThemedColor.primary,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 12,
        },
    });
