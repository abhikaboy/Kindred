import { Dimensions, StyleSheet, TextInput, TouchableOpacity, View, Animated, KeyboardAvoidingView, Platform } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { CountryPicker } from "react-native-country-codes-picker";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const PhoneOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData, updateOnboardingData } = useOnboarding();
    
    const [show, setShow] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneNumber, setPhoneNumber] = useState("");

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleContinue = () => {
        // Store phone number in onboarding context
        const fullPhoneNumber = `${countryCode}${phoneNumber}`;
        updateOnboardingData({ 
            phone: fullPhoneNumber
        });
        router.push("/(onboarding)/verify-phone");
    };

    const formatPhoneNumber = (text: string) => {
        // Remove all non-numeric characters
        const cleaned = text.replace(/\D/g, '');
        setPhoneNumber(cleaned);
    };

    const isValidPhone = phoneNumber.length >= 10;

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

            <CountryPicker
                lang="en"
                show={show}
                pickerButtonOnPress={(item) => {
                    setCountryCode(item.dial_code);
                    setShow(false);
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
                        borderRadius: 16,
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

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.contentContainer}>
                    {/* Header Section */}
                    <Animated.View 
                        style={[
                            styles.headerContainer,
                            {
                                opacity: fadeAnimation,
                                transform: [{ translateY: slideAnimation }],
                            }
                        ]}
                    >
                        <ThemedText style={styles.titleText}>
                            What's your phone number?
                        </ThemedText>
                        <ThemedText style={styles.subtitleText}>
                            We'll send you a verification code
                        </ThemedText>
                    </Animated.View>

                    {/* Input Section */}
                    <Animated.View 
                        style={[
                            styles.inputContainer,
                            {
                                opacity: fadeAnimation,
                            }
                        ]}
                    >
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
                                placeholder="(555) 123-4567"
                                placeholderTextColor={ThemedColor.caption}
                                value={phoneNumber}
                                onChangeText={formatPhoneNumber}
                                keyboardType="phone-pad"
                                autoFocus
                                maxLength={15}
                            />
                        </View>
                        
                        <ThemedText style={[styles.helperText, { color: ThemedColor.caption }]}>
                            Standard messaging rates may apply
                        </ThemedText>
                    </Animated.View>

                    {/* Button Section */}
                    <Animated.View 
                        style={[
                            styles.buttonContainer,
                            {
                                opacity: fadeAnimation,
                            }
                        ]}
                    >
                        <PrimaryButton
                            title="Continue"
                            onPress={handleContinue}
                            disabled={!isValidPhone}
                        />
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
    },
    keyboardView: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.20,
        justifyContent: 'space-between',
        paddingBottom: 20,
        zIndex: 1,
    },
    headerContainer: {
        gap: 12,
    },
    titleText: {
        fontSize: Math.min(screenWidth * 0.085, 32),
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: Math.min(screenWidth * 0.102, 38),
        letterSpacing: -1,
    },
    subtitleText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        opacity: 0.6,
        marginTop: 8,
    },
    inputContainer: {
        flex: 1,
        marginTop: 40,
    },
    phoneInputWrapper: {
        flexDirection: 'row',
        gap: 12,
    },
    countryCodeButton: {
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
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
        paddingHorizontal: 24,
        borderRadius: 16,
    },
    helperText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        marginTop: 12,
        marginLeft: 4,
    },
    buttonContainer: {
        width: '100%',
    },
});

export default PhoneOnboarding;
