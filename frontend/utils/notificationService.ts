import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Configure notifications appearance in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Register for push notifications
export async function registerForPushNotificationsAsync() {
    let token;

    if (!Device.isDevice) {
        console.log("Must use physical device for Push Notifications");
        return null;
    }

    // Check permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return null;
    }

    // Get token
    token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    // Get previous token from storage
    const previousToken = await AsyncStorage.getItem("pushToken");

    // Only send to backend if token is new or has changed
    if (!previousToken || previousToken !== token.data) {
        await AsyncStorage.setItem("pushToken", token.data);
        return { token: token.data, isNew: true };
    }

    // Android notification channel setup
    if (Platform.OS === "android") {
        Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
        });
    }

    return { token: token.data, isNew: false };
}

// Send token to backend - only called when necessary
export async function sendPushTokenToBackend(token) {
    try {
        // Make API call to your backend
        // const response = await fetch('your-api-endpoint', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ token }),
        // });

        console.log("Push token registered with backend:", token);
        return true;
    } catch (error) {
        console.error("Failed to register token with backend:", error);
        return false;
    }
}

// Handle received notifications
export function addNotificationListener(handler) {
    return Notifications.addNotificationReceivedListener(handler);
}

// Handle notification response (when user taps notification)
export function addNotificationResponseListener(handler) {
    return Notifications.addNotificationResponseReceivedListener(handler);
}
