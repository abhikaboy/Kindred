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
    setVisible: (visible: boolean) => void;
    title: string;
    message?: string;
    buttons?: AlertButton[];
};

const CustomAlert = ({ visible, setVisible, title, message, buttons = [] }: Props) => {
    const ThemedColor = useThemeColor();

    const handleButtonPress = (button: AlertButton) => {
        // Only run the handler and close if the modal is actually visible
        if (!visible) return;

        if (button.onPress) {
            button.onPress();
        }
        
        // Delay dismissal slightly to allow for animations/state updates if needed
        // But more importantly to prevent race conditions
        setTimeout(() => {
            // Only dismiss if the button action didn't navigate away or unmount
            // and if the modal is still conceptually "visible" in state
            setVisible(false);
        }, 100);
    };

    // Default "OK" button if none provided
    const alertButtons: AlertButton[] = buttons.length > 0 ? buttons : [{ text: "OK", style: "default" }];

    // Sort buttons to ensure Cancel is always last
    // Create a copy to avoid mutating props
    const sortedButtons = [...alertButtons].sort((a, b) => {
        if (a.style === "cancel") return 1;
        if (b.style === "cancel") return -1;
        return 0;
    });

    return (
        <DefaultModal 
            visible={visible} 
            setVisible={setVisible} 
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
        paddingHorizontal: 0, // Remove double padding since DefaultModal adds it
        paddingBottom: 128, // Increased bottom padding even more
    },
    header: {
        alignItems: "center", // Left align
        marginBottom: 32,
        width: "100%",
    },
    title: {
        fontSize: 24,
        textAlign: "center", // Left align
        marginBottom: 8,
        letterSpacing: -0.5, // Loosen tight tracking slightly if needed, or just standard
    },
    message: {
        textAlign: "left", // Left align
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

export default CustomAlert;

