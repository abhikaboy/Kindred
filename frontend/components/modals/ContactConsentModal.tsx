import React from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
    visible: boolean;
    onAccept: () => void;
    onDecline: () => void;
};

/**
 * Contact Consent Modal
 * 
 * This modal is required for App Store compliance (Guideline 5.1.2).
 * It informs users that their contacts will be uploaded to our server
 * and requests explicit consent before accessing their contacts.
 */
const ContactConsentModal = ({ visible, onAccept, onDecline }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <DefaultModal 
            visible={visible} 
            setVisible={() => {}} // Prevent dismissal by tapping outside
            enableDynamicSizing={true}
            enablePanDownToClose={false}
        >
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + '20' }]}>
                        <Ionicons name="people-outline" size={32} color={ThemedColor.primary} />
                    </View>
                </View>

                <View style={styles.header}>
                    <ThemedText type="title" style={styles.title}>
                        Find Your Friends on Kindred
                    </ThemedText>
                </View>

                <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <ThemedText type="default" style={styles.description}>
                            To help you connect with friends who are already using Kindred, we'd like to access your contacts.
                        </ThemedText>

                        <View style={styles.infoSection}>
                            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                                What happens with your contacts:
                            </ThemedText>
                            
                            <View style={styles.bulletPoint}>
                                <View style={[styles.bullet, { backgroundColor: ThemedColor.primary }]} />
                                <ThemedText type="default" style={styles.bulletText}>
                                    Your contact phone numbers will be securely uploaded to our server
                                </ThemedText>
                            </View>

                            <View style={styles.bulletPoint}>
                                <View style={[styles.bullet, { backgroundColor: ThemedColor.primary }]} />
                                <ThemedText type="default" style={styles.bulletText}>
                                    We'll match them with existing Kindred users to help you find friends
                                </ThemedText>
                            </View>

                            <View style={styles.bulletPoint}>
                                <View style={[styles.bullet, { backgroundColor: ThemedColor.primary }]} />
                                <ThemedText type="default" style={styles.bulletText}>
                                    Your contacts are only used for friend discovery and are not shared with other users
                                </ThemedText>
                            </View>

                            <View style={styles.bulletPoint}>
                                <View style={[styles.bullet, { backgroundColor: ThemedColor.primary }]} />
                                <ThemedText type="default" style={styles.bulletText}>
                                    You can manage your privacy settings at any time in your account settings
                                </ThemedText>
                            </View>
                        </View>

                        <ThemedText type="caption" style={[styles.privacyNote, { color: ThemedColor.text + 'CC' }]}>
                            By tapping "Allow", you consent to uploading your contacts to our server for friend matching. 
                            For more details, see our{' '}
                            <ThemedText type="caption" style={[styles.link, { color: ThemedColor.primary }]}>
                                Privacy Policy
                            </ThemedText>.
                        </ThemedText>
                    </View>
                </ScrollView>

                <View style={styles.actions}>
                    <TouchableOpacity
                        onPress={onAccept}
                        style={[
                            styles.button,
                            styles.primaryButton,
                            { backgroundColor: ThemedColor.primary }
                        ]}
                    >
                        <ThemedText 
                            type="defaultSemiBold" 
                            style={[styles.buttonText, { color: '#FFFFFF' }]}
                        >
                            Allow
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onDecline}
                        style={[
                            styles.button,
                            styles.secondaryButton,
                            { 
                                backgroundColor: ThemedColor.background,
                                borderColor: ThemedColor.tertiary,
                            }
                        ]}
                    >
                        <ThemedText 
                            type="defaultSemiBold" 
                            style={[styles.buttonText, { color: ThemedColor.text }]}
                        >
                            Not Now
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </DefaultModal>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 0,
        paddingBottom: 32,
    },
    iconContainer: {
        alignItems: "center",
        marginBottom: 16,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        alignItems: "center",
        marginBottom: 16,
        width: "100%",
    },
    title: {
        fontSize: 24,
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    contentScroll: {
        maxHeight: 400,
        marginBottom: 24,
    },
    content: {
        gap: 16,
    },
    description: {
        textAlign: "left",
        lineHeight: 22,
        opacity: 0.9,
    },
    infoSection: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        marginBottom: 4,
    },
    bulletPoint: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 8,
    },
    bulletText: {
        flex: 1,
        lineHeight: 22,
        opacity: 0.8,
    },
    privacyNote: {
        fontSize: 12,
        lineHeight: 18,
        textAlign: "left",
        marginTop: 8,
    },
    link: {
        textDecorationLine: "underline",
    },
    actions: {
        flexDirection: "column",
        width: "100%",
        gap: 12,
    },
    button: {
        width: "100%",
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
    },
    primaryButton: {
        // backgroundColor set dynamically
    },
    secondaryButton: {
        borderWidth: 1,
    },
    buttonText: {
        fontSize: 16,
        textAlign: "center",
    },
});

export default ContactConsentModal;
