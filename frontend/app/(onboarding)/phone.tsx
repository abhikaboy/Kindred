import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { CountryPicker } from "react-native-country-codes-picker";
import { getThemedColor } from "@/constants/Colors";
import OnboardButton from "@/components/inputs/OnboardButton";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {};

const Index = (props: Props) => {
    let ThemedColor = useThemeColor();
    const [show, setShow] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");
    const [flag, setFlag] = useState("");

    const [phoneNumber, setPhoneNumber] = useState("");

    const router = useRouter();

    return (
        <ThemedView
            style={{
                paddingTop: Dimensions.get("screen").height * 0.2,
                paddingHorizontal: HORIZONTAL_PADDING,
                gap: 24,
            }}>
            <CountryPicker
                lang="en"
                show={show}
                // when picker button press you will get the country object with dial code
                pickerButtonOnPress={(item) => {
                    setCountryCode(item.dial_code);
                    setFlag(item.flag);
                    setShow(false);
                }}
                popularCountries={["US", "CA", "GB", "AU", "IN"]}
                style={{
                    modal: {
                        top: Dimensions.get("screen").height * 0.25,
                        height: Dimensions.get("screen").height * 1,
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
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: ThemedColor.lightened,
                        paddingVertical: 24,
                        color: ThemedColor.text,
                    },
                    searchMessageText: {
                        color: ThemedColor.text,
                        fontFamily: "Outfit",
                    },
                }}
            />
            <ThemedText type="title">Whats your phone number?</ThemedText>
            <View
                style={{
                    flexDirection: "row",
                    gap: 4,
                    width: "100%",
                    justifyContent: "center",
                    paddingHorizontal: HORIZONTAL_PADDING,
                }}>
                <TouchableOpacity
                    style={{
                        padding: 20,
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 24,
                    }}
                    onPress={() => {
                        setShow(true);
                    }}>
                    <ThemedText type="default">{countryCode}</ThemedText>
                </TouchableOpacity>
                <TextInput
                    style={{
                        padding: 24,
                        backgroundColor: ThemedColor.lightened,
                        color: ThemedColor.text,
                        borderRadius: 24,
                        width: "100%",
                    }}
                    placeholder="phone number"
                    value={phoneNumber}
                    onChangeText={(text) => {
                        setPhoneNumber(text);
                    }}
                />
            </View>
            <OnboardButton
                disabled={phoneNumber.length < 10}
                onPress={() => {
                    router.push("/(onboarding)/phone");
                }}
            />
        </ThemedView>
    );
};

export default Index;

const styles = StyleSheet.create({});
