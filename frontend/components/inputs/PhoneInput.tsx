import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { CountryPicker } from "react-native-country-codes-picker";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { Dimensions } from "react-native";

const { height: screenHeight } = Dimensions.get('window');

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    forceTheme?: "light" | "dark";
};

export const PhoneInput = ({ value, onChangeText, placeholder = "(555) 123-4567", autoFocus = false, forceTheme }: Props) => {
    const ThemedColor = useThemeColor(forceTheme);
    const [show, setShow] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneNumber, setPhoneNumber] = useState("");

    const formatPhoneNumber = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        setPhoneNumber(cleaned);
        const fullPhoneNumber = `${countryCode}${cleaned}`;
        onChangeText(fullPhoneNumber);
    };

    const getDisplayPhoneNumber = () => {
        if (countryCode !== '+1' || phoneNumber.length === 0) {
            return phoneNumber;
        }
        const digits = phoneNumber;
        if (digits.length <= 3) {
            return `(${digits}`;
        }
        if (digits.length <= 6) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        }
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    };

    return (
        <>
            <CountryPicker
                lang="en"
                show={show}
                pickerButtonOnPress={(item) => {
                    setCountryCode(item.dial_code);
                    setShow(false);
                    const fullPhoneNumber = `${item.dial_code}${phoneNumber}`;
                    onChangeText(fullPhoneNumber);
                }}
                popularCountries={["US", "CA", "GB", "AU", "IN"]}
                style={{
                    modal: {
                        top: screenHeight * 0.25,
                        height: screenHeight,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        backgroundColor: ThemedColor.background,
                    },
                    itemsList: {
                        backgroundColor: ThemedColor.background,
                    },
                    countryButtonStyles: {
                        backgroundColor: ThemedColor.lightened,
                    },
                    countryName: {
                        color: ThemedColor.text,
                        fontFamily: "Outfit",
                    },
                    dialCode: {
                        color: ThemedColor.text,
                        fontFamily: "Outfit",
                    },
                    countryMessageContainer: {
                        backgroundColor: ThemedColor.lightened,
                    },
                    textInput: {
                        borderRadius: 12,
                        padding: 16,
                        backgroundColor: ThemedColor.lightened,
                        paddingVertical: 24,
                        color: ThemedColor.text,
                        fontFamily: "Outfit",
                    },
                    searchMessageText: {
                        color: ThemedColor.text,
                        fontFamily: "Outfit",
                    },
                }}
            />

            <View style={[styles.unifiedWrapper, { backgroundColor: ThemedColor.lightened }]}>
                <TouchableOpacity
                    style={styles.countryCodeButton}
                    onPress={() => setShow(true)}
                    activeOpacity={0.7}
                >
                    <ThemedText style={styles.countryCodeText}>
                        {countryCode}
                    </ThemedText>
                </TouchableOpacity>

                <TextInput
                    style={[styles.phoneInput, { color: ThemedColor.text }]}
                    placeholder={placeholder}
                    placeholderTextColor={ThemedColor.caption}
                    value={getDisplayPhoneNumber()}
                    onChangeText={formatPhoneNumber}
                    keyboardType="phone-pad"
                    autoFocus={autoFocus}
                    maxLength={14}
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    unifiedWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingLeft: 20,
    },
    countryCodeButton: {
        paddingVertical: 20,
        paddingRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 60,
    },
    countryCodeText: {
        fontSize: 18,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
    phoneInput: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'Outfit',
        fontWeight: '400',
        paddingVertical: 20,
        paddingRight: 24,
        backgroundColor: 'transparent',
    },
});
