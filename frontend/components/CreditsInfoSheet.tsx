import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Animated, Linking } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';

interface CreditsInfoSheetProps {
    visible: boolean;
    onClose: () => void;
    currentCredits: number;
}

const { height } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = height * 0.85;

export const CreditsInfoSheet: React.FC<CreditsInfoSheetProps> = ({ 
    visible, 
    onClose,
    currentCredits 
}) => {
    const ThemedColor = useThemeColor();
    const slideAnim = useRef(new Animated.Value(-SHEET_MAX_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    
    console.log('CreditsInfoSheet render - visible:', visible, 'credits:', currentCredits);
    
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -SHEET_MAX_HEIGHT,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, slideAnim, backdropOpacity]);
    
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.modalContainer}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    >
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Sheet Content */}
                <Animated.View 
                    style={[
                        styles.sheetContainer, 
                        { 
                            backgroundColor: ThemedColor.background,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    {/* Handle Bar */}
                    <View style={[styles.handleBar, { backgroundColor: ThemedColor.caption + '40' }]} />

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: ThemedColor.tertiary }]}>
                        <ThemedText type="subtitle" style={styles.headerTitle}>
                            Natural Language Credits
                        </ThemedText>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* What are credits */}
                        <View style={styles.section}>
                            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                                What are Natural Language Credits?
                            </ThemedText>
                            <ThemedText type="default" style={[styles.sectionText, { color: ThemedColor.caption }]}>
                                Each time you use AI to generate tasks from text or speech, you use 1 natural language credit. 
                                This powerful feature understands your input and creates structured tasks automatically.
                            </ThemedText>
                        </View>

                        {/* How to get more */}
                        <View style={styles.section}>
                            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                                How to Get More Credits
                            </ThemedText>
                            
                            {/* Send Kudos */}
                            <View style={[styles.methodCard, { backgroundColor: ThemedColor.lightenedCard }]}>
                                <View style={[styles.iconCircle, { backgroundColor: ThemedColor.primary + '20' }]}>
                                    <Ionicons name="heart" size={20} color={ThemedColor.primary} />
                                </View>
                                <View style={styles.methodContent}>
                                    <ThemedText type="defaultSemiBold">
                                        Send Kudos
                                    </ThemedText>
                                    <ThemedText type="default" style={[styles.methodDescription, { color: ThemedColor.caption }]}>
                                        Recognize team members' great work by sending kudos. Earn credits when others appreciate your contributions too!
                                    </ThemedText>
                                </View>
                            </View>

                            {/* Purchase Premium */}
                            <View style={[styles.methodCard, { backgroundColor: ThemedColor.lightenedCard }]}>
                                <View style={[styles.iconCircle, { backgroundColor: '#FFD700' + '20' }]}>
                                    <Ionicons name="star" size={20} color="#FFD700" />
                                </View>
                                <View style={styles.methodContent}>
                                    <ThemedText type="defaultSemiBold">
                                        Purchase Premium
                                    </ThemedText>
                                    <ThemedText type="default" style={[styles.methodDescription, { color: ThemedColor.caption }]}>
                                        Upgrade to Premium for unlimited natural language credits, plus access to advanced analytics, 
                                        priority support, and exclusive features.
                                    </ThemedText>
                                </View>
                            </View>
                        </View>

                        {/* Subscription Links - Required by App Store Guidelines 3.1.2 */}
                        <View style={[styles.linksSection, { borderTopColor: ThemedColor.tertiary }]}>
                            <ThemedText type="default" style={[styles.linksTitle, { color: ThemedColor.caption }]}>
                                Subscription Information
                            </ThemedText>
                            <View style={styles.linksContainer}>
                                <TouchableOpacity 
                                    onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}
                                    style={styles.linkButton}
                                >
                                    <ThemedText type="default" style={[styles.linkText, { color: ThemedColor.primary }]}>
                                        Privacy Policy
                                    </ThemedText>
                                    <Ionicons name="open-outline" size={16} color={ThemedColor.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                                    style={styles.linkButton}
                                >
                                    <ThemedText type="default" style={[styles.linkText, { color: ThemedColor.primary }]}>
                                        Terms of Use
                                    </ThemedText>
                                    <Ionicons name="open-outline" size={16} color={ThemedColor.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheetContainer: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        height: height * 0.85,
        paddingTop: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        marginVertical: 24,
    },
    sectionTitle: {
        fontSize: 16,
        marginBottom: 12,
    },
    sectionText: {
        lineHeight: 22,
    },
    methodCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    methodContent: {
        flex: 1,
    },
    methodDescription: {
        marginTop: 4,
        lineHeight: 20,
        fontSize: 14,
    },
    tipsCard: {
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    linksSection: {
        marginTop: 32,
        paddingTop: 24,
        borderTopWidth: 1,
    },
    linksTitle: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    linksContainer: {
        gap: 12,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    linkText: {
        fontSize: 14,
    },
});

