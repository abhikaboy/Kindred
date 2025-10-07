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
};

export const PhoneInput = ({ value, onChangeText, placeholder = "(555) 123-4567", autoFocus = false }: Props) => {
    const ThemedColor = useThemeColor();
    const [show, setShow] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneNumber, setPhoneNumber] = useState("");

    const formatPhoneNumber = (text: string) => {
        // Remove all non-numeric characters
        const cleaned = text.replace(/\D/g, '');
        setPhoneNumber(cleaned);
        
        // Update parent with full phone number including country code
        const fullPhoneNumber = `${countryCode}${cleaned}`;
        onChangeText(fullPhoneNumber);
    };

    return (
        <>
            <CountryPicker
                lang="en"
                show={show}
                pickerButtonOnPress={(item) => {
                    setCountryCode(item.dial_code);
                    setShow(false);
                    // Update parent with new country code
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

            <View style={styles.phoneInputWrapper}>
                <TouchableOpacity
                    style={[
                        styles.countryCodeButton,
                        { backgroundColor: ThemedColor.lightened }
                    ]}
                    onPress={() => setShow(true)}
                    activeOpacity={0.7}
                >
                    <ThemedText style={styles.countryCodeText}>
                        {countryCode}
                    </ThemedText>
                </TouchableOpacity>
                
                <TextInput
                    style={[
                        styles.phoneInput,
                        {
                            backgroundColor: ThemedColor.lightened,
                            color: ThemedColor.text,
                        }
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={ThemedColor.caption}
                    value={phoneNumber}
                    onChangeText={formatPhoneNumber}
                    keyboardType="phone-pad"
                    autoFocus={autoFocus}
                    maxLength={15}
                />
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    phoneInputWrapper: {
        flexDirection: 'row',
        gap: 12,
    },
    countryCodeButton: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 70,
    },
    countryCodeText: {
        fontSize: 16,
        fontFamily: 'OutfitLight',
        fontWeight: '500',
    },
    phoneInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'OutfitLight',
        fontWeight: '400',
        paddingVertical: 16,
        paddingHorizontal: 22,
        borderRadius: 12,
    },
});
