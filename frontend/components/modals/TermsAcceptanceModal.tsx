import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface TermsAcceptanceModalProps {
    visible: boolean;
    onAccept: () => void;
}

export default function TermsAcceptanceModal({ visible, onAccept }: TermsAcceptanceModalProps) {
    const ThemedColor = useThemeColor();

    const handleOpenTerms = () => {
        Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
    };

    const handleOpenPrivacy = () => {
        Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {}} // Prevent dismissal
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: ThemedColor.background }]}>
                    <View style={styles.content}>
                        <ThemedText type="title" style={styles.title}>
                            Terms of Service
                        </ThemedText>

                        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
                            <ThemedText type="default" style={styles.paragraph}>
                                Before you continue, please read and accept our Terms of Service.
                            </ThemedText>

                            <ThemedText type="subtitle" style={styles.sectionTitle}>
                                Community Standards
                            </ThemedText>

                            <ThemedText type="default" style={styles.paragraph}>
                                Kindred has <ThemedText type="defaultSemiBold">zero tolerance</ThemedText> for:
                            </ThemedText>

                            <View style={styles.bulletList}>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Hate speech, harassment, or discrimination
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Explicit, violent, or offensive content
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Bullying, threats, or abusive behavior
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Spam or misleading information
                                </ThemedText>
                            </View>

                            <ThemedText type="subtitle" style={styles.sectionTitle}>
                                Content Moderation
                            </ThemedText>

                            <ThemedText type="default" style={styles.paragraph}>
                                We reserve the right to:
                            </ThemedText>

                            <View style={styles.bulletList}>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Review and remove content that violates our policies
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Suspend or terminate accounts for violations
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Take action based on user reports
                                </ThemedText>
                            </View>

                            <ThemedText type="subtitle" style={styles.sectionTitle}>
                                Your Responsibilities
                            </ThemedText>

                            <ThemedText type="default" style={styles.paragraph}>
                                By using Kindred, you agree to:
                            </ThemedText>

                            <View style={styles.bulletList}>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Treat all users with respect
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Report inappropriate content or behavior
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Follow all community guidelines
                                </ThemedText>
                                <ThemedText type="default" style={styles.bullet}>
                                    • Accept consequences for violations
                                </ThemedText>
                            </View>

                            <View style={styles.linksContainer}>
                                <TouchableOpacity onPress={handleOpenTerms}>
                                    <ThemedText type="link" style={styles.link}>
                                        Read Full Terms of Service →
                                    </ThemedText>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleOpenPrivacy}>
                                    <ThemedText type="link" style={styles.link}>
                                        Read Privacy Policy →
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.acceptButton, { backgroundColor: ThemedColor.primary }]}
                            onPress={onAccept}
                        >
                            <ThemedText type="defaultSemiBold" style={styles.acceptButtonText}>
                                I Agree to the Terms
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 500,
        maxHeight: '80%',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 28,
        marginBottom: 16,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
        marginBottom: 20,
    },
    paragraph: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        marginTop: 12,
        marginBottom: 8,
    },
    bulletList: {
        marginLeft: 8,
        marginBottom: 16,
    },
    bullet: {
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 4,
    },
    linksContainer: {
        marginTop: 16,
        marginBottom: 8,
        gap: 12,
    },
    link: {
        fontSize: 15,
        marginBottom: 8,
    },
    acceptButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
});
