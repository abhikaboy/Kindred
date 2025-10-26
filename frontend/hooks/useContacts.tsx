import { useState, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { Platform, Alert, Linking } from 'react-native';

export interface ContactInfo {
    id: string;
    name: string;
    phoneNumbers?: string[];
    emails?: string[];
}

export interface ContactsResponse {
    numbers: string[];
    contactsMap: { [phoneNumber: string]: string }; // Map of phone number to contact name
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
                    Alert.alert(
                        'Contacts Permission Denied',
                        'To find your friends on Kindred, we need access to your contacts. You can enable this in your device settings.',
                        [
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
                    );
                } else {
                    // Permission request was cancelled or not determined
                    Alert.alert(
                        'Permission Required',
                        'Kindred needs access to your contacts to help you find friends who are already using the app.',
                        [{ text: 'OK' }]
                    );
                }
                return { numbers: [], contactsMap: {} };
            }

            // Fetch contacts
            const { data } = await Contacts.getContactsAsync({
                fields: [
                    Contacts.Fields.Name,
                    Contacts.Fields.PhoneNumbers,
                ],
            });

            if (!data || data.length === 0) {
                return { numbers: [], contactsMap: {} };
            }

            // Extract all phone numbers into a flat array and create a map
            const phoneNumbers: string[] = [];
            const contactsMap: { [phoneNumber: string]: string } = {};
            
            data.forEach(contact => {
                const contactName = contact.name || 'Unknown';
                
                if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                    contact.phoneNumbers.forEach(phoneNumber => {
                        const number = phoneNumber.number || phoneNumber.digits;
                        if (number) {
                            phoneNumbers.push(number);
                            contactsMap[number] = contactName;
                        }
                    });
                }
            });

            return { numbers: phoneNumbers, contactsMap };
        } catch (error) {
            console.error('Error fetching contacts:', error);
            Alert.alert('Error', 'Failed to fetch contacts. Please try again.');
            return { numbers: [], contactsMap: {} };
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

