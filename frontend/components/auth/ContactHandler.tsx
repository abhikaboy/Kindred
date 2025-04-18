import { useEffect } from "react";

import { StyleSheet, Text, View } from "react-native";
import React from "react";
import * as Contacts from "expo-contacts";

type Props = {};

const ContactHandler = (props: Props) => {
    useEffect(() => {
        (async () => {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === "granted") {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
                });

                if (data.length > 0) {
                    const contact = data[0];
                    console.log(contact);
                }
            }
        })();
    }, []);

    return <View></View>;
};

export default ContactHandler;

const styles = StyleSheet.create({});
