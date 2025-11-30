import React from "react";
import { Linking } from "react-native";
import { INTEGRATION_DICTIONARY } from "@/constants/integrationDictionary";

export type IntegrationType = keyof typeof INTEGRATION_DICTIONARY;

// Helper function to get integration icon
export const getIntegrationIcon = (integration: string | undefined, color: string, size: number = 20) => {
    if (!integration) return null;

    const data = INTEGRATION_DICTIONARY[integration.toLowerCase()];
    if (!data) return null;

    return data.icon({ size, color });
};

// Helper function to get integration display name
export const getIntegrationName = (integration: string | undefined): string => {
    if (!integration) return "";

    const data = INTEGRATION_DICTIONARY[integration.toLowerCase()];
    return data ? data.name : integration.charAt(0).toUpperCase() + integration.slice(1);
};

// Helper function to open app
export const openIntegrationApp = async (integration: string | undefined): Promise<{ success: boolean; title?: string; message?: string }> => {
    if (!integration) return { success: false };

    const integrationLower = integration.toLowerCase();
    const data = INTEGRATION_DICTIONARY[integrationLower];
    const appName = getIntegrationName(integration);

    if (!data) {
        return { success: false, title: "Error", message: `Unknown integration: ${appName}` };
    }

    if (data.errorMessage) {
        return { success: false, title: data.name, message: data.errorMessage };
    }

    if (!data.url) {
         // Fallback if URL is empty but no error message provided (shouldn't happen with current dict)
         return { success: false, title: "Error", message: `Cannot open ${appName}` };
    }

    try {
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
            await Linking.openURL(data.url);
            return { success: true };
        } else {
            return { success: false, title: "Error", message: `Cannot open ${appName}` };
        }
    } catch (error) {
        console.error("Error opening integration app:", error);
        return { success: false, title: "Error", message: `Failed to open ${appName}` };
    }
};
