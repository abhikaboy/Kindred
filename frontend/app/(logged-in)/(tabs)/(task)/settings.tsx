import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Dimensions, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as StoreReview from 'expo-store-review';
import { deleteAccount } from '@/api/auth';
import { showToast } from '@/utils/showToast';

const { width: screenWidth } = Dimensions.get('window');

export default function Settings() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { logout } = useAuth();
    
    // State for all toggle switches
    const [settings, setSettings] = useState({
        friendActivity: true,
        nearDeadlines: true,
        showTaskDetails: true,
        recentWorkspaces: true,
    });

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = () => {
        // TODO: Implement save functionality
        console.log('Saving settings:', settings);
        // Could show a toast here
    };

    const handleBack = () => {
        router.back();
    };

    const handleContactSupport = () => {
        // TODO: Implement contact support functionality
        console.log('Contact support pressed');
    };

    const handleRateKindred = async () => {
        try {
            // Check if store review is available on this platform
            const isAvailable = await StoreReview.isAvailableAsync();
            
            if (isAvailable) {
                // Request the native in-app review
                await StoreReview.requestReview();
            } else {
                // Fallback: show alert with option to go to store
                Alert.alert(
                    'Rate Kindred',
                    'We\'d love your feedback! Would you like to rate us in the app store?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                            text: 'Rate Now', 
                            onPress: async () => {
                                const storeUrl = StoreReview.storeUrl();
                                if (storeUrl) {
                                    // This will open the app store
                                    const Linking = await import('expo-linking');
                                    await Linking.default.openURL(storeUrl);
                                } else {
                                    Alert.alert('Error', 'Unable to open app store at this time.');
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error requesting store review:', error);
            Alert.alert(
                'Error', 
                'Unable to open review at this time. Please try again later.'
            );
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data including tasks, categories, and friend connections.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete Account', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAccount();
                            showToast('Account deleted successfully', 'success');
                            logout();
                            router.replace('/login');
                        } catch (error) {
                            console.error('Delete account error:', error);
                            showToast('Failed to delete account', 'danger');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Logout', 
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        router.replace('/login');
                    }
                }
            ]
        );
    };

    const styles = createStyles(ThemedColor, screenWidth);

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                
                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Settings
                </ThemedText>
                
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                    <ThemedText type="defaultSemiBold" style={styles.saveText}>
                        Save
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {/* Display Section */}
            <View style={styles.content}>
                <ThemedText type="caption" style={styles.sectionHeader}>
                    DISPLAY
                </ThemedText>
                
                <View style={styles.settingsContainer}>
                    <View style={styles.settingRow}>
                        <ThemedText type="lightBody" style={styles.settingLabel}>
                            Friend Activity
                        </ThemedText>
                        <Switch
                            value={settings.friendActivity}
                            onValueChange={() => handleToggle('friendActivity')}
                            trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor={ThemedColor.tertiary}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <ThemedText type="lightBody" style={styles.settingLabel}>
                            Near Deadlines
                        </ThemedText>
                        <Switch
                            value={settings.nearDeadlines}
                            onValueChange={() => handleToggle('nearDeadlines')}
                            trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor={ThemedColor.tertiary}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <ThemedText type="lightBody" style={styles.settingLabel}>
                            Show Task Details
                        </ThemedText>
                        <Switch
                            value={settings.showTaskDetails}
                            onValueChange={() => handleToggle('showTaskDetails')}
                            trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor={ThemedColor.tertiary}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <ThemedText type="lightBody" style={styles.settingLabel}>
                            Recent Workspaces
                        </ThemedText>
                        <Switch
                            value={settings.recentWorkspaces}
                            onValueChange={() => handleToggle('recentWorkspaces')}
                            trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor={ThemedColor.tertiary}
                        />
                    </View>
                </View>

                {/* Resources Section */}
                <View style={styles.resourcesSection}>
                    <ThemedText type="caption" style={styles.sectionHeader}>
                        RESOURCES
                    </ThemedText>
                    
                    <TouchableOpacity 
                        style={styles.resourceItem} 
                        onPress={handleContactSupport}
                        activeOpacity={0.7}
                    >
                        <ThemedText type="lightBody" style={styles.resourceLabel}>
                            Contact Support
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.resourceItem} 
                        onPress={handleRateKindred}
                        activeOpacity={0.7}
                    >
                        <View style={styles.rateRow}>
                            <ThemedText type="lightBody" style={styles.resourceLabel}>
                                Rate Kindred
                            </ThemedText>
                            <Ionicons name="star-outline" size={24} color={ThemedColor.text} />
                        </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.deleteAccountItem} 
                        onPress={handleDeleteAccount}
                        activeOpacity={0.7}
                    >
                        <ThemedText type="lightBody"> 
                            Delete Account
                        </ThemedText>
                        <Ionicons name="trash-outline" size={24} color={ThemedColor.error} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.logoutItem} 
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <ThemedText type="lightBody">
                            Logout
                        </ThemedText>
                        <Ionicons name="log-out-outline" size={24} color={ThemedColor.error} />
                    </TouchableOpacity>
                </View>
            </View>
        </ThemedView>
    );
}

const createStyles = (ThemedColor: any, screenWidth: number) => {
    const horizontalPadding = Math.max(20, screenWidth * 0.05);
    
    return StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: 60,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: horizontalPadding,
            marginBottom: 40,
        },
        backButton: {
            minWidth: 40,
            alignItems: 'flex-start',
        },
        headerTitle: {
            flex: 1,
            textAlign: 'center',
        },
        saveButton: {
            minWidth: 40,
            alignItems: 'flex-end',
        },
        saveText: {
            color: ThemedColor.text,
        },
        content: {
            flex: 1,
            paddingHorizontal: horizontalPadding,
        },
        sectionHeader: {
            marginBottom: 16,
            fontSize: 12,
            letterSpacing: 1,
        },
        settingsContainer: {
            backgroundColor: ThemedColor.lightened,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 15,
            marginBottom: 40,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 1,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        settingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            minHeight: 36,
        },
        settingLabel: {
            flex: 1,
            color: ThemedColor.caption,
        },
        resourcesSection: {
            flex: 1,
        },
        resourceItem: {
            paddingVertical: 15,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ThemedColor.tertiary,
        },
        resourceLabel: {
            color: ThemedColor.text,
        },
        rateRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        deleteAccountItem: {
            paddingVertical: 15,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ThemedColor.tertiary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        logoutItem: {
            paddingVertical: 15,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ThemedColor.tertiary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        logoutLabel: {
            color: ThemedColor.destructive,
        },
    });
};
