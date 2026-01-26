import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "@/components/ThemedText";

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
}

type Props = {
    visible: boolean;
    onDismiss: () => void;
    title: string;
    message?: string;
    buttons?: AlertButton[];
};

const QueuedAlert = ({ visible, onDismiss, title, message, buttons = [] }: Props) => {
    const ThemedColor = useThemeColor();

    const handleButtonPress = (button: AlertButton) => {
        // Just call the button's handler
        // The AlertContext will handle dismissal
        if (button.onPress) {
            button.onPress();
        }
    };

    // Default "OK" button if none provided
    const alertButtons: AlertButton[] = buttons.length > 0 ? buttons : [{ text: "OK", style: "default" }];

    // Sort buttons to ensure Cancel is always last
    const sortedButtons = [...alertButtons].sort((a, b) => {
        if (a.style === "cancel") return 1;
        if (b.style === "cancel") return -1;
        return 0;
    });

    return (
        <DefaultModal 
            visible={visible} 
            setVisible={(v) => !v && onDismiss()} 
            enableDynamicSizing={true}
            enablePanDownToClose={false}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText type="title" style={styles.title}>{title}</ThemedText>
                    {message && (
                        <ThemedText type="default" style={styles.message}>
                            {message}
                        </ThemedText>
                    )}
                </View>

                <View style={[
                    styles.actions,
                    {
                        backgroundColor: ThemedColor.background,
                        borderColor: ThemedColor.tertiary,
                        shadowColor: "#000",
                        shadowOffset: {
                            width: 0,
                            height: 1,
                        },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 2,
                    }
                ]}>
                    {sortedButtons.map((button, index) => {
                        const isDestructive = button.style === "destructive";
                        const isCancel = button.style === "cancel";
                        const isLast = index === sortedButtons.length - 1;
                        
                        return (
                            <React.Fragment key={index}>
                                <TouchableOpacity
                                    onPress={() => handleButtonPress(button)}
                                    style={styles.button}
                                >
                                    <ThemedText 
                                        type="defaultSemiBold" 
                                        style={{ 
                                            color: (isDestructive || isCancel) ? ThemedColor.error : ThemedColor.text,
                                            textAlign: "center"
                                        }}
                                    >
                                        {button.text}
                                    </ThemedText>
                                </TouchableOpacity>
                                {!isLast && (
                                    <View style={[styles.separator, { backgroundColor: ThemedColor.tertiary }]} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </View>
            </View>
        </DefaultModal>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 0,
        paddingBottom: 128,
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
        width: "100%",
    },
    title: {
        fontSize: 24,
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    message: {
        textAlign: "left",
        opacity: 0.8,
        lineHeight: 22,
    },
    actions: {
        flexDirection: "column",
        width: "100%",
        borderRadius: 16,
        borderWidth: 1,
        overflow: "hidden",
    },
    button: {
        width: "100%",
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    separator: {
        width: "100%",
        height: 1,
    }
});

export default QueuedAlert;
