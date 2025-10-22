import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import { Icons } from "@/constants/Icons";
import { router } from "expo-router";
import { getConnectionsByReceiverAPI } from "@/api/connection";

type FollowRequestProps = {
    name: string;
    username: string;
    icon: string;
    userId: string;
    connectionID: string;
};

interface FollowRequestsSectionProps {
    styles: any;
    maxVisible?: number; // How many requests to show before "see all"
}

export const FollowRequestsSection = ({ styles, maxVisible = 3 }: FollowRequestsSectionProps) => {
    const [requests, setRequests] = useState<FollowRequestProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFollowRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const connections = await getConnectionsByReceiverAPI();
            
            // Transform API response to match FollowRequestProps interface
            const transformedRequests: FollowRequestProps[] = connections.map((connection) => ({
                name: connection.requester.name,
                username: connection.requester.handle,
                icon: connection.requester.picture || Icons.coffee,
                userId: connection.requester._id,
                connectionID: connection.id,
            }));
            
            setRequests(transformedRequests);
        } catch (err) {
            console.error('Failed to fetch follow requests:', err);
            setError('Failed to load follow requests');
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const removeRequest = (connectionID: string) => {
        setRequests(prev => prev.filter(request => request.connectionID !== connectionID));
    };

    useEffect(() => {
        fetchFollowRequests();
    }, []);

    // Don't render anything while loading
    if (loading) return null;
    
    // Don't render if there's an error or no requests
    if (error || requests.length === 0) return null;

    return (
        <View style={styles.friendRequestsSection || styles.section}>
            <View style={styles.friendRequestsHeader || { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <ThemedText type="subtitle">Friend Requests</ThemedText>
                {requests.length > maxVisible && (
                    <Pressable onPress={() => router.push("/FollowRequests")}>
                        <ThemedText type="caption">see all {requests.length}</ThemedText>
                    </Pressable>
                )}
            </View>
            {requests.slice(0, maxVisible).map((request) => (
                <View style={styles.requestItem || styles.listItem} key={`follow-${request.connectionID}`}>
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
    );
};

