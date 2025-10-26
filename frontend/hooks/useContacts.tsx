import { useState, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { Platform, Alert } from 'react-native';

export interface ContactInfo {
    id: string;
    name: string;
    phoneNumbers?: string[];
    emails?: string[];
}

export interface ContactsResponse {
    numbers: string[];
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
                Alert.alert(
                    'Permission Required',
                    'Please enable contacts permission in your device settings to import contacts.',
                    [{ text: 'OK' }]
                );
                return { numbers: [] };
            }

            // Fetch contacts
            const { data } = await Contacts.getContactsAsync({
                fields: [
                    Contacts.Fields.PhoneNumbers,
                ],
            });

            if (!data || data.length === 0) {
                return { numbers: [] };
            }

            // Extract all phone numbers into a flat array
            const phoneNumbers: string[] = [];
            
            data.forEach(contact => {
                if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                    contact.phoneNumbers.forEach(phoneNumber => {
                        const number = phoneNumber.number || phoneNumber.digits;
                        if (number) {
                            phoneNumbers.push(number);
                        }
                    });
                }
            });

            return { numbers: phoneNumbers };
        } catch (error) {
            console.error('Error fetching contacts:', error);
            Alert.alert('Error', 'Failed to fetch contacts. Please try again.');
            return { numbers: [] };
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

