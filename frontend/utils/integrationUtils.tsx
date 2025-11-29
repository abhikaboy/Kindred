import React from "react";
import { Linking } from "react-native";
import {
    AmazonLogo,
    EnvelopeSimple,
    ChatsCircle,
    LinkedinLogo,
    GoogleChromeLogo,
    CompassTool,
    SlackLogo,
} from "phosphor-react-native";

export type IntegrationType = "amazon" | "gmail" | "outlook" | "imessage" | "slack" | "linkedin" | "chrome" | "safari";

// Helper function to get integration icon
export const getIntegrationIcon = (integration: string | undefined, color: string, size: number = 20) => {
    if (!integration) return null;
    
    const weight = "regular" as const;
    
    switch (integration.toLowerCase()) {
        case "amazon":
            return <AmazonLogo size={size} color={color} weight={weight} />;
        case "gmail":
            return <EnvelopeSimple size={size} color={color} weight={weight} />;
        case "outlook":
            return <EnvelopeSimple size={size} color={color} weight="fill" />;
        case "imessage":
            return <ChatsCircle size={size} color={color} weight="fill" />;
        case "slack":
            return <SlackLogo size={size} color={color} weight="fill" />;
        case "linkedin":
            return <LinkedinLogo size={size} color={color} weight="fill" />;
        case "chrome":
            return <GoogleChromeLogo size={size} color={color} weight="fill" />;
        case "safari":
            return <CompassTool size={size} color={color} weight={weight} />;
        default:
            return null;
    }
};

// Helper function to get integration display name
export const getIntegrationName = (integration: string | undefined): string => {
    if (!integration) return "";
    
    switch (integration.toLowerCase()) {
        case "amazon":
            return "Amazon";
        case "gmail":
            return "Gmail";
        case "outlook":
            return "Outlook";
        case "imessage":
            return "iMessage";
        case "slack":
            return "Slack";
        case "linkedin":
            return "LinkedIn";
        case "chrome":
            return "Chrome";
        case "safari":
            return "Safari";
        default:
            return integration.charAt(0).toUpperCase() + integration.slice(1);
    }
};

// Helper function to open app
export const openIntegrationApp = async (integration: string | undefined): Promise<{ success: boolean; title?: string; message?: string }> => {
    if (!integration) return { success: false };
    
    const integrationLower = integration.toLowerCase();
    let url = "";
    let appName = getIntegrationName(integration);
    
    switch (integrationLower) {
        case "amazon":
            url = "https://www.amazon.com/";
            break;
        case "gmail":
            url = "https://mail.google.com/";
            break;
        case "outlook":
            url = "https://outlook.live.com/";
            break;
        case "imessage":
            // iMessage doesn't have a web URL, only iOS app
            return { success: false, title: "iMessage", message: "Please open the iMessage app on your device" };
        case "slack":
            url = "https://slack.com/";
            break;
        case "linkedin":
            url = "https://www.linkedin.com/";
            break;
        case "chrome":
            // Chrome is a browser, not a specific destination
            return { success: false, title: "Chrome", message: "Chrome is already your default browser" };
        case "safari":
            // Safari is a browser, not a specific destination
            return { success: false, title: "Safari", message: "Safari is your default browser" };
        default:
            return { success: false, title: "Error", message: `Unknown integration: ${appName}` };
    }
    
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
            return { success: true };
        } else {
            return { success: false, title: "Error", message: `Cannot open ${appName}` };
        }
    } catch (error) {
        console.error("Error opening integration app:", error);
        return { success: false, title: "Error", message: `Failed to open ${appName}` };
    }
};


