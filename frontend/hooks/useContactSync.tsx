import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as Contacts from "expo-contacts";
import { findUsersByPhoneHashes } from "@/api/profile";
import { useContacts } from "@/hooks/useContacts";
import { useContactConsent } from "@/hooks/useContactConsent";
import { useMatchedContacts, type MatchedContact } from "@/hooks/useMatchedContacts";
import type { AlertButton } from "@/components/modals/CustomAlert";

type AlertState = { visible: boolean; title: string; message: string; buttons: AlertButton[] };

const OK_BUTTON: AlertButton[] = [{ text: "OK", style: "default" }];

/**
 * Finds friends from the device's contacts: consent first, then a hashed lookup.
 * Shared by the search and friends pages so both show the same prompts and results.
 */
export function useContactSync() {
    const { getContacts, isLoading: isLoadingContacts } = useContacts();
    const { matchedContacts, addMatchedContacts, isLoading: isLoadingMatchedContacts } = useMatchedContacts();
    const { hasConsent, grantConsent, denyConsent } = useContactConsent();

    const [alert, setAlert] = useState<AlertState>({ visible: false, title: "", message: "", buttons: [] });
    const [consentVisible, setConsentVisible] = useState(false);
    const contactsMapRef = useRef<{ [phoneNumber: string]: string }>({});

    const showAlert = useCallback((title: string, message: string, buttons: AlertButton[] = OK_BUTTON) => {
        setAlert({ visible: true, title, message, buttons });
    }, []);

    const setAlertVisible = useCallback((visible: boolean) => {
        setAlert((prev) => ({ ...prev, visible }));
    }, []);

    const findUsersMutation = useMutation({
        mutationFn: findUsersByPhoneHashes,
        onSuccess: (matchedUsers) => {
            if (matchedUsers.length === 0) return;
            const newMatchedContacts: MatchedContact[] = matchedUsers.map((user) => ({
                user,
                contactName: contactsMapRef.current[user.phone_hash] || "Unknown",
            }));
            addMatchedContacts(newMatchedContacts);
            showAlert("Friends Found!", `Found ${matchedUsers.length} of your contacts on Kindred! Scroll down to see them.`);
        },
        onError: (error) => {
            console.error("Error finding users by phone numbers:", error);
            showAlert("Error", "Failed to find contacts. Please try again.");
        },
    });

    const performSync = useCallback(async () => {
        try {
            const contactsResponse = await getContacts();

            if (contactsResponse.alert) {
                showAlert(
                    contactsResponse.alert.title,
                    contactsResponse.alert.message,
                    contactsResponse.alert.buttons || OK_BUTTON
                );
                return;
            }

            // No numbers and permission granted means the contacts simply have none saved
            if (contactsResponse.phoneHashes.length === 0) {
                const { status } = await Contacts.getPermissionsAsync();
                if (status === "granted") {
                    showAlert(
                        "No Phone Numbers Found",
                        "We couldn't find any phone numbers in your contacts. Make sure your contacts have phone numbers saved."
                    );
                }
                return;
            }

            contactsMapRef.current = contactsResponse.contactsMap;
            findUsersMutation.mutate(contactsResponse.phoneHashes);
        } catch (error) {
            console.error("Error getting contacts:", error);
            showAlert("Error", "Failed to access contacts. Please try again.");
        }
    }, [getContacts, findUsersMutation, showAlert]);

    const acceptConsent = useCallback(async () => {
        try {
            await grantConsent();
            setConsentVisible(false);
            await performSync();
        } catch (error) {
            console.error("Error granting consent:", error);
            showAlert("Error", "Failed to save your consent. Please try again.");
        }
    }, [grantConsent, performSync, showAlert]);

    const declineConsent = useCallback(async () => {
        try {
            await denyConsent();
            setConsentVisible(false);
            showAlert("Contact Sync Declined", "You can enable contact syncing later from your account settings.");
        } catch (error) {
            console.error("Error denying consent:", error);
            setConsentVisible(false);
        }
    }, [denyConsent, showAlert]);

    // Consent is asked once; after that the sync runs straight through
    const sync = useCallback(async () => {
        if (hasConsent === true) {
            await performSync();
        } else if (hasConsent === false) {
            showAlert(
                "Contact Sync Disabled",
                "You previously declined contact syncing. You can enable it in your account settings."
            );
        } else {
            setConsentVisible(true);
        }
    }, [hasConsent, performSync, showAlert]);

    return {
        sync,
        isSyncing: isLoadingContacts || findUsersMutation.isPending,
        // Consent is only granted by a sync, so a granted consent means contacts were already synced
        hasSynced: hasConsent === true,
        matchedContacts,
        isLoadingMatchedContacts,
        alert,
        setAlertVisible,
        consentVisible,
        acceptConsent,
        declineConsent,
    };
}
