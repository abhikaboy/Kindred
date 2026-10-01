import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { SealCheck, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import AssistantMark from "@/components/assistants/AssistantMark";
import ConnectionCodeEntry from "@/components/assistants/ConnectionCodeEntry";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAssistantConnections, type AssistantConnection } from "@/hooks/useAssistantConnections";
import { MCP_CONNECTOR_URL, lastUsedLabel, scopeSummary } from "@/utils/assistantConnections";
import { showToast } from "@/utils/showToast";

// Settings sub-screen (same shell as blocked-users and released tasks).
export default function ConnectedAssistants() {
    const ThemedColor = useThemeColor();
    const { code } = useLocalSearchParams<{ code?: string }>();
    const { assistants, personalTokens, isLoading, isError, refetch } = useAssistantConnections();
    const [refreshing, setRefreshing] = React.useState(false);
    const empty = assistants.length === 0 && personalTokens.length === 0;

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch().catch(() => {});
        setRefreshing(false);
    };

    const copyUrl = async () => {
        await Clipboard.setStringAsync(MCP_CONNECTOR_URL);
        showToast("Connector URL copied", "success");
    };

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
                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Connected assistants
                </ThemedText>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {isLoading && empty ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={ThemedColor.caption} />
                    </View>
                ) : isError && empty ? (
                    <ThemedText type="caption">
                        Couldn't load your connected assistants. Pull down to try again.
                    </ThemedText>
                ) : empty ? (
                    <Animated.View entering={FadeIn.duration(200)}>
                        <ThemedText type="default">
                            To connect an assistant, add{" "}
                            <ThemedText type="default" style={{ color: ThemedColor.primary }} onPress={copyUrl}>
                                {MCP_CONNECTOR_URL}
                            </ThemedText>{" "}
                            as a connector in Claude or Grok.
                        </ThemedText>
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.sections}>
                        {assistants.length > 0 && (
                            <View>
                                {assistants.map((c) => (
                                    <ConnectionRow key={c.id} connection={c} />
                                ))}
                            </View>
                        )}
                        {personalTokens.length > 0 && (
                            <View style={styles.section}>
                                <SectionTitle title="Access tokens" />
                                <View>
                                    {personalTokens.map((c) => (
                                        <ConnectionRow key={c.id} connection={c} />
                                    ))}
                                </View>
                            </View>
                        )}
                    </Animated.View>
                )}

                <View style={styles.codeEntry}>
                    <ConnectionCodeEntry initiallyOpen={code === "1"} />
                </View>
            </ScrollView>
        </View>
    );
}

function ConnectionRow({ connection }: { connection: AssistantConnection }) {
    const ThemedColor = useThemeColor();
    const isToken = connection.kind === "token";
    const meta = [
        isToken ? connection.tokenPrefix && `${connection.tokenPrefix}...` : connection.host,
        scopeSummary(connection.scopes),
        lastUsedLabel(connection.lastUsedAt),
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            accessibilityRole="button"
            onPress={() =>
                router.push({
                    pathname: "/(logged-in)/(tabs)/(profile)/connected-assistant",
                    params: { id: connection.id, kind: connection.kind },
                })
            }>
            <View style={styles.lead}>
                <AssistantMark logoUri={connection.logoUri} token={isToken} />
            </View>
            <View style={styles.rowText}>
                <View style={styles.nameLine}>
                    <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.name}>
                        {connection.name}
                    </ThemedText>
                    {connection.verified && (
                        <View accessible accessibilityLabel="Verified app">
                            <SealCheck size={16} color={ThemedColor.primary} weight="fill" />
                        </View>
                    )}
                </View>
                <ThemedText type="caption" numberOfLines={2}>
                    {meta}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
    },
    placeholder: {
        width: 40,
    },
    center: {
        paddingTop: 32,
        alignItems: "center",
    },
    body: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    sections: {
        gap: 32,
    },
    section: {
        gap: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    lead: {
        width: 52,
    },
    rowText: {
        flex: 1,
        gap: 4,
    },
    nameLine: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    name: {
        flexShrink: 1,
    },
    codeEntry: {
        marginTop: 32,
    },
});
