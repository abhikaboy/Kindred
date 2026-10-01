import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle, SealCheck, WarningCircle, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import AssistantMark from "@/components/assistants/AssistantMark";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAlert } from "@/contexts/AlertContext";
import {
    useAssistantActivity,
    useAssistantConnections,
    useDisconnectAssistant,
    type ConnectionKind,
} from "@/hooks/useAssistantConnections";
import { lastUsedLabel, timeAgo } from "@/utils/assistantConnections";
import { showToast } from "@/utils/showToast";

// One connected assistant or access token: what it can do, what it did recently, and disconnect.
export default function ConnectedAssistant() {
    const ThemedColor = useThemeColor();
    const { showAlert } = useAlert();
    const { id, kind } = useLocalSearchParams<{ id: string; kind?: ConnectionKind }>();
    const { assistants, personalTokens, isLoading } = useAssistantConnections();
    const disconnect = useDisconnectAssistant();
    const activity = useAssistantActivity(id);

    const connection = [...assistants, ...personalTokens].find((c) => c.id === id && (!kind || c.kind === kind));
    const isToken = connection?.kind === "token";

    const confirmDisconnect = () => {
        if (!connection) return;
        const action = isToken ? "Revoke" : "Disconnect";
        showAlert({
            title: `${action} ${connection.name}?`,
            message: isToken
                ? "Anything using this token loses access to your Kindred account right away."
                : `${connection.name} loses access to your Kindred account right away. You can connect it again later.`,
            buttons: [
                { text: "Cancel", style: "cancel" },
                {
                    text: action,
                    style: "destructive",
                    onPress: () => {
                        router.back();
                        disconnect(connection).catch(() =>
                            showToast(
                                `Couldn't ${action.toLowerCase()} ${connection.name}. Something went wrong on our end. Give it another try.`,
                                "danger"
                            )
                        );
                    },
                },
            ],
        });
    };

    const scopes = (connection?.scopes ?? []).map((s) =>
        typeof s === "string" ? { id: s, title: s, description: "" } : s
    );
    const created = connection ? timeAgo(connection.createdAt) : null;

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close">
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            </View>

            {!connection ? (
                <View style={styles.body}>
                    {isLoading ? (
                        <ActivityIndicator color={ThemedColor.caption} />
                    ) : (
                        <ThemedText type="caption">This connection is no longer active.</ThemedText>
                    )}
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, styles.sections]}>
                    <View style={styles.identity}>
                        <AssistantMark logoUri={connection.logoUri} token={isToken} size={48} />
                        <View style={styles.nameLine}>
                            <ThemedText type="fancyFrauncesSubheading" numberOfLines={2} style={styles.shrink}>
                                {connection.name}
                            </ThemedText>
                            {connection.verified && (
                                <View accessible accessibilityLabel="Verified app">
                                    <SealCheck size={22} color={ThemedColor.primary} weight="fill" />
                                </View>
                            )}
                        </View>
                        <ThemedText type="caption">
                            {[
                                isToken ? connection.tokenPrefix && `${connection.tokenPrefix}...` : connection.host,
                                !isToken && !connection.verified ? "Unverified app" : null,
                                created && `Connected ${created}`,
                                lastUsedLabel(connection.lastUsedAt),
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </ThemedText>
                    </View>

                    {scopes.length > 0 && (
                        <View style={styles.section}>
                            <SectionTitle title="What it can do" />
                            <View style={styles.list}>
                                {scopes.map((s) => (
                                    <View key={s.id} style={styles.tight}>
                                        <ThemedText type="default">{s.title}</ThemedText>
                                        {!!s.description && <ThemedText type="caption">{s.description}</ThemedText>}
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.section}>
                        <SectionTitle title="Recent activity" />
                        {activity.isLoading ? (
                            <ActivityIndicator color={ThemedColor.caption} style={styles.start} />
                        ) : activity.isError ? (
                            <ThemedText type="caption">Couldn't load recent activity.</ThemedText>
                        ) : (activity.data ?? []).length === 0 ? (
                            <ThemedText type="caption">Nothing yet</ThemedText>
                        ) : (
                            <Animated.View entering={FadeIn.duration(200)} style={styles.list}>
                                {(activity.data ?? []).map((a) => (
                                    <View key={a.id} style={styles.activityRow}>
                                        <View style={styles.lead}>
                                            {a.ok ? (
                                                <CheckCircle size={20} color={ThemedColor.caption} />
                                            ) : (
                                                <WarningCircle size={20} color={ThemedColor.error} />
                                            )}
                                        </View>
                                        <View style={[styles.tight, styles.shrink]}>
                                            <ThemedText type="default">{a.summary || a.tool}</ThemedText>
                                            <ThemedText type="caption">
                                                {[a.ok ? null : "Failed", timeAgo(a.created_at)]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </ThemedText>
                                        </View>
                                    </View>
                                ))}
                            </Animated.View>
                        )}
                    </View>

                    <PrimaryButton
                        title={isToken ? "Revoke token" : "Disconnect"}
                        onPress={confirmDisconnect}
                        ghost
                        colorOverride={ThemedColor.error}
                        style={styles.disconnect}
                    />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 8,
        alignItems: "flex-start",
    },
    backButton: {
        padding: 8,
    },
    body: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 120,
    },
    sections: {
        gap: 32,
    },
    identity: {
        gap: 12,
    },
    nameLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    shrink: {
        flexShrink: 1,
    },
    section: {
        gap: 12,
    },
    list: {
        gap: 16,
    },
    tight: {
        gap: 4,
    },
    activityRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    lead: {
        width: 32,
        paddingTop: 2,
    },
    start: {
        alignSelf: "flex-start",
    },
    disconnect: {
        alignSelf: "flex-start",
        width: "auto",
        paddingHorizontal: 0,
    },
});
