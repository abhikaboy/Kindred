import React from "react";
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

export interface IntegrationData {
    name: string;
    icon: (props: { size: number; color: string; weight?: "regular" | "fill" | "thin" | "light" | "bold" | "duotone" }) => React.ReactNode;
    url: string;
    isBrowser?: boolean; // For Chrome/Safari specific messaging
    isAppOnly?: boolean; // For iMessage
    errorMessage?: string;
}

export const INTEGRATION_DICTIONARY: Record<string, IntegrationData> = {
    amazon: {
        name: "Amazon",
        icon: (props) => <AmazonLogo {...props} />,
        url: "https://www.amazon.com/",
    },
    gmail: {
        name: "Gmail",
        icon: (props) => <EnvelopeSimple {...props} />,
        url: "https://mail.google.com/",
    },
    outlook: {
        name: "Outlook",
        icon: (props) => <EnvelopeSimple {...props} weight="fill" />,
        url: "https://outlook.live.com/",
    },
    imessage: {
        name: "iMessage",
        icon: (props) => <ChatsCircle {...props} weight="fill" />,
        url: "",
        isAppOnly: true,
        errorMessage: "Please open the iMessage app on your device",
    },
    slack: {
        name: "Slack",
        icon: (props) => <SlackLogo {...props} weight="fill" />,
        url: "https://slack.com/",
    },
    linkedin: {
        name: "LinkedIn",
        icon: (props) => <LinkedinLogo {...props} weight="fill" />,
        url: "https://www.linkedin.com/",
    },
    chrome: {
        name: "Chrome",
        icon: (props) => <GoogleChromeLogo {...props} weight="fill" />,
        url: "",
        isBrowser: true,
        errorMessage: "Chrome is already your default browser",
    },
    safari: {
        name: "Safari",
        icon: (props) => <CompassTool {...props} />,
        url: "",
        isBrowser: true,
        errorMessage: "Safari is your default browser",
    },
};

