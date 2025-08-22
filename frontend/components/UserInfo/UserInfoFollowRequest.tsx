import React, { useState, useRef } from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions, Animated } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PreviewIcon from "../profile/PreviewIcon";
import PrimaryButton from "../inputs/PrimaryButton";
import { router } from "expo-router";
import { acceptConnectionAPI, deleteConnectionAPI } from "@/api/connection";
import { showToast } from "@/utils/showToast";

type Props = {
    name: string;
    username: string;
    icon: string;
    userId: string;
    connectionID: string;
    onRequestHandled?: () => void; // Callback to remove this request from parent state (no refetch)
};

const UserInfoFollowRequest = ({ name, username, icon, userId, connectionID, onRequestHandled }: Props) => {
    const [isLoading, setIsLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const animateOut = (callback: () => void) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            callback();
        });
    };

    const handleAccept = async () => {
        try {
            setIsLoading(true);
            await acceptConnectionAPI(connectionID);
            showToast(`Accepted ${name}'s friend request`, 'success');
            
            // Only remove from state if API call was successful
            animateOut(() => {
                onRequestHandled?.(); // Remove this request from parent state
            });
        } catch (error) {
            console.error('Failed to accept connection:', error);
            showToast('Failed to accept friend request', 'danger');
            // Keep the request in the list so user can try again
            setIsLoading(false);
        }
    };

    const handleDeny = async () => {
        try {
            setIsLoading(true);
            await deleteConnectionAPI(connectionID);
            showToast(`Denied ${name}'s friend request`, 'success');
            
            // Only remove from state if API call was successful
            animateOut(() => {
                onRequestHandled?.(); // Remove this request from parent state
            });
            // Note: setIsLoading(false) not needed here since component will be removed
        } catch (error) {
            console.error('Failed to deny connection:', error);
            showToast('Failed to deny friend request', 'danger');
            // Keep the request in the list so user can try again
            setIsLoading(false);
        }
    };

    return (
    <Animated.View 
        style={{ 
            flexDirection: "row", 
            alignItems: "center", 
            width: "100%",
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
        }}
    >
        <View style={styles.row}>
                <TouchableOpacity onPress={() => router.push(`/account/${userId}`)}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <PreviewIcon size={"smallMedium"} icon={icon}></PreviewIcon>
                <View style={{ gap: 0 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                        <ThemedText
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{ fontWeight: 500 }}
                            type="smallerDefault">
                            {name}
                        </ThemedText>
                    </View>
                    <ThemedText numberOfLines={1} ellipsizeMode="tail" type={"caption"}>
                        {username}
                    </ThemedText>
                </View>
            </View>
                                </TouchableOpacity>
            <View style={styles.buttons}>
                <TouchableOpacity 
                    onPress={handleDeny}
                    disabled={isLoading}
                    style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                    <ThemedText style={{ fontSize: 14 }}>
                        Deny
                    </ThemedText>
                </TouchableOpacity>
                <PrimaryButton
                    style={{ width: 85, paddingVertical: 10, paddingHorizontal: 10 }}
                    title={"Accept"}
                    onPress={handleAccept}
                    disabled={isLoading}
                />
            </View>
        </View>
    </Animated.View>
    );
};

export default UserInfoFollowRequest;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        flex: 1,
        justifyContent: "space-between",
        width: "100%",
        alignItems: "center",
    },
    buttons: {
        flexDirection: "row",
        flex: 1,
        gap: 14,
        alignItems: "center",
        justifyContent: "flex-end",
    },
    buttonText: {
        fontSize: 16,
    },
});
