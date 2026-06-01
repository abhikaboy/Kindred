import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import ReferralCard from "@/components/profile/ReferralCard";
import { Icons } from "@/constants/Icons";
import { getConnectionsByReceiverAPI } from "@/api/connection";

type FollowRequest = {
    name: string;
    username: string;
    icon: string;
    userId: string;
    connectionID: string;
};

type Props = {
    horizontalPadding: number;
};

export default function RequestsTab({ horizontalPadding }: Props) {
    const ThemedColor = useThemeColor();
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const connections = await getConnectionsByReceiverAPI();
            setRequests(
                connections.map((c) => ({
                    name: c.requester.name,
                    username: c.requester.handle,
                    icon: c.requester.picture || Icons.coffee,
                    userId: c.requester._id,
                    connectionID: c.id,
                })),
            );
        } catch (e) {
            console.error("Failed to load follow requests:", e);
            setError("Couldn't load follow requests");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const removeRequest = (connectionID: string) => {
        setRequests((prev) => prev.filter((r) => r.connectionID !== connectionID));
    };

    if (loading) {
        return (
            <View style={[styles.center, { paddingHorizontal: horizontalPadding }]}>
                <ActivityIndicator color={ThemedColor.text} />
            </View>
        );
    }

    return (
        <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ThemedColor.text} />
            }>
            {error ? (
                <View style={styles.emptyBlock}>
                    <ThemedText style={{ color: "red", textAlign: "center" }}>{error}</ThemedText>
                </View>
            ) : requests.length === 0 ? (
                <View
                    style={[
                        styles.emptyBlock,
                        { backgroundColor: ThemedColor.tertiary + "30" },
                    ]}>
                    <ThemedText style={{ color: ThemedColor.caption, textAlign: "center" }}>
                        No pending follow requests
                    </ThemedText>
                </View>
            ) : (
                <View style={styles.list}>
                    {requests.map((request) => (
                        <View key={`follow-${request.connectionID}`} style={styles.listItem}>
                            <UserInfoFollowRequest
                                name={request.name}
                                icon={request.icon}
                                username={request.username}
                                userId={request.userId}
                                connectionID={request.connectionID}
                                onRequestHandled={() => removeRequest(request.connectionID)}
                            />
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.inviteWrap}>
                <ReferralCard />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    scrollContent: {
        paddingTop: 20,
        paddingBottom: 40,
    },
    emptyBlock: {
        paddingVertical: 24,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    list: {
        gap: 14,
    },
    listItem: {},
    inviteWrap: {
        marginTop: 24,
    },
});
