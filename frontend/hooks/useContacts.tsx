import { useState, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { Platform, Linking } from 'react-native';
import { hashPhone } from '@/utils/phone';

export interface ContactInfo {
    id: string;
    name: string;
    phoneNumbers?: string[];
    emails?: string[];
}

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
}

export interface ContactsResponse {
    /**
     * Salted SHA-256 hashes of the E.164-normalized contact numbers. Only these
     * are ever sent to the server — raw numbers stay on the device.
     */
    phoneHashes: string[];
    contactsMap: { [phoneHash: string]: string }; // Map of phone hash to contact name
    alert?: {
        title: string;
        message: string;
        buttons?: AlertButton[];
    };
}

export function useContacts() {
    const [isLoading, setIsLoading] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            const granted = status === 'granted';
            setHasPermission(granted);
            return granted;
        } catch (error) {
            console.error('Error requesting contacts permission:', error);
            setHasPermission(false);
            return false;
        }
    }, []);

    const getContacts = useCallback(async (): Promise<ContactsResponse> => {
        setIsLoading(true);
        try {
            // Check/request permission
            const { status } = await Contacts.getPermissionsAsync();
            let granted = status === 'granted';

            if (!granted) {
                granted = await requestPermission();
            }

            if (!granted) {
                // Show different messages based on permission status
                const { status } = await Contacts.getPermissionsAsync();
                
                if (status === 'denied') {
                    // Permission was explicitly denied
                    return {
                        phoneHashes: [],
                        contactsMap: {},
                        alert: {
                            title: 'Contacts Permission Denied',
                            message: 'To find your friends on Kindred, we need access to your contacts. You can enable this in your device settings.',
                            buttons: [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                    text: 'Open Settings', 
                                    onPress: () => {
                                        if (Platform.OS === 'ios') {
                                            Linking.openURL('app-settings:');
                                        } else {
                                            Linking.openSettings();
                                        }
                                    }
                                }
                            ]
                        }
                    };
                } else {
                    // Permission request was cancelled or not determined
                    return {
                        phoneHashes: [],
                        contactsMap: {},
                        alert: {
                            title: 'Permission Required',
                            message: 'Kindred needs access to your contacts to help you find friends who are already using the app.',
                            buttons: [{ text: 'OK' }]
                        }
                    };
                }
            }

            // Fetch contacts
            const { data } = await Contacts.getContactsAsync({
                fields: [
                    Contacts.Fields.Name,
                    Contacts.Fields.PhoneNumbers,
                ],
            });

            if (!data || data.length === 0) {
                return { phoneHashes: [], contactsMap: {} };
            }

            // Normalize and hash every number on-device. contactsMap is keyed by
            // hash so matched users can still be labelled with the local
            // contact's name without that name or number leaving the phone.
            // Numbers that can't be parsed into E.164 hash to null and are
            // dropped, since they could never match a stored user anyway.
            const contactsMap: { [phoneHash: string]: string } = {};

            for (const contact of data) {
                const contactName = contact.name || 'Unknown';
                if (!contact.phoneNumbers?.length) continue;

                for (const phoneNumber of contact.phoneNumbers) {
                    const number = phoneNumber.number || phoneNumber.digits;
                    if (!number) continue;

                    const hash = await hashPhone(number);
                    if (!hash) continue;
                    contactsMap[hash] = contactName;
                }
            }

            return { phoneHashes: Object.keys(contactsMap), contactsMap };
        } catch (error) {
            console.error('Error fetching contacts:', error);
            return {
                phoneHashes: [],
                contactsMap: {},
                alert: {
                    title: 'Error',
                    message: 'Failed to fetch contacts. Please try again.'
                }
            };
        } finally {
            setIsLoading(false);
        }
    }, [requestPermission]);

    return {
        getContacts,
        requestPermission,
        isLoading,
        hasPermission,
    };
}

