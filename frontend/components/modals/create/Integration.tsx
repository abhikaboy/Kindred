import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { Screen } from "../CreateModal";
import {
    AmazonLogo,
    EnvelopeSimple,
    ChatsCircle,
    LinkedinLogo,
    GoogleChromeLogo,
    CompassTool,
    SlackLogo,
} from "phosphor-react-native";

type Props = {
    goTo: (screen: Screen) => void;
};

type IntegrationOption = {
    id: string;
    name: string;
    icon: React.ReactNode;
};

const Integration = ({ goTo }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const { setIntegration, integration } = useTaskCreation();

    const integrations: IntegrationOption[] = [
        {
            id: "amazon",
            name: "Amazon",
            icon: <AmazonLogo size={28} color={ThemedColor.text} weight="regular" />,
        },
        {
            id: "gmail",
            name: "Gmail",
            icon: <EnvelopeSimple size={28} color={ThemedColor.text} weight="regular" />,
        },
        {
            id: "outlook",
            name: "Outlook",
            icon: <EnvelopeSimple size={28} color={ThemedColor.text} weight="fill" />,
        },
        {
            id: "imessage",
            name: "iMessage",
            icon: <ChatsCircle size={28} color={ThemedColor.text} weight="fill" />,
        },
        {
            id: "slack",
            name: "Slack",
            icon: <SlackLogo size={28} color={ThemedColor.text} weight="fill" />,
        },
        {
            id: "linkedin",
            name: "LinkedIn",
            icon: <LinkedinLogo size={28} color={ThemedColor.text} weight="fill" />,
        },
        {
            id: "chrome",
            name: "Chrome",
            icon: <GoogleChromeLogo size={28} color={ThemedColor.text} weight="fill" />,
        },
        {
            id: "safari",
            name: "Safari",
            icon: <CompassTool size={28} color={ThemedColor.text} weight="regular" />,
        },
    ];

    const handleSelectIntegration = (integrationId: string) => {
        setIntegration(integrationId);
        goTo(Screen.STANDARD);
    };

    return (
        <View style={styles.container}>
            <ThemedText type="subtitle" style={styles.title}>
                Select Integration
            </ThemedText>
            <ThemedText style={styles.description}>
                Choose an app to integrate with this task
            </ThemedText>

            <View style={styles.optionsContainer}>
                {integrations.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.optionCard,
                            integration === option.id && styles.optionCardSelected,
                        ]}
                        onPress={() => handleSelectIntegration(option.id)}
                        activeOpacity={0.7}>
                        <View style={styles.iconContainer}>{option.icon}</View>
                        <ThemedText
                            style={[
                                styles.optionName,
                                integration === option.id && styles.optionNameSelected,
                            ]}>
                            {option.name}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        title: {
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 8,
        },
        description: {
            fontSize: 14,
            color: ThemedColor.caption,
            marginBottom: 24,
            fontFamily: "Outfit",
        },
        optionsContainer: {
            gap: 12,
        },
        optionCard: {
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: "transparent",
        },
        optionCardSelected: {
            borderColor: ThemedColor.primary,
            backgroundColor: ThemedColor.primaryLightened,
        },
        iconContainer: {
            marginRight: 16,
        },
        optionName: {
            fontSize: 16,
            fontWeight: "500",
            color: ThemedColor.text,
            fontFamily: "Outfit",
        },
        optionNameSelected: {
            fontWeight: "600",
            color: ThemedColor.primary,
        },
    });

export default Integration;

