import { Dimensions, StyleSheet, View, Animated, TouchableOpacity, Image } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useOnboarding } from "@/hooks/useOnboarding";
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect } from "react-native-svg";
import { showToast } from "@/utils/showToast";
import { uploadImageSmart } from "@/api/upload";
import { useAuth } from "@/hooks/useAuth";
import { ObjectId } from "bson";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const PhotoOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { onboardingData, updateProfilePicture, validationErrors, registerWithEmail, registerWithApple, isLoading } = useOnboarding();
    const { user } = useAuth();
    
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 800,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 800,
                delay: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Request permissions
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast('Camera roll permissions are needed to select a photo', 'warning');
            }
        })();
    }, []);

    const pickImage = async () => {
        try {
            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== "granted") {
                showToast("Camera roll permissions are required to select a photo", "warning");
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
            });

            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                setSelectedImage(uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            showToast("Failed to pick image. Please try again.", "danger");
        }
    };

    const handleContinue = async () => {
        if (!selectedImage) {
            showToast('Please select a profile photo to continue', 'warning');
            return;
        }
        
        setIsUploading(true);
        
        try {
            // Step 1: Generate a temporary ObjectID for the upload
            // This follows the same pattern as banner image upload in Details.tsx
            const tempUserId = new ObjectId().toString();
            console.log('Generated temporary user ID for upload:', tempUserId);
            
            // Step 2: Upload the profile picture with the temporary ID
            console.log('Uploading profile picture with temporary ID...');
            const profilePictureUrl = await uploadImageSmart("profile", tempUserId, selectedImage, { variant: "medium" });
            
            const uploadedUrl = typeof profilePictureUrl === 'string' 
                ? profilePictureUrl 
                : profilePictureUrl.public_url;
            
            console.log('Profile picture uploaded successfully:', uploadedUrl);
            
            // Step 3: Update onboarding data with the uploaded URL
            updateProfilePicture(uploadedUrl);
            
            // Step 4: Register the user with the uploaded profile picture URL
            console.log('Registering user with uploaded profile picture...');
            
            // Check if this is an Apple registration or email registration
            if (onboardingData.appleId) {
                await registerWithApple(uploadedUrl);
            } else {
                await registerWithEmail(uploadedUrl);
            }
            
            console.log('User registered successfully!');
            showToast('Account created successfully! 🎉', 'success');
            
            // Step 5: Navigate to notifications screen
            router.push('/(onboarding)/notifications');
            
        } catch (error: any) {
            console.error('Registration or upload error:', error);
            
            let errorMessage = 'Unable to create account. Please try again.';
            
            if (error.message) {
                if (error.message.includes('upload') || error.message.includes('image')) {
                    errorMessage = 'Failed to upload profile picture. Please try again.';
                } else {
                    errorMessage = error.message;
                }
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.toString().includes('email')) {
                errorMessage = 'This email is already registered. Please use a different email.';
            } else if (error.toString().includes('handle')) {
                errorMessage = 'This handle is already taken. Please choose a different one.';
            }
            
            showToast(errorMessage, 'danger');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSkip = async () => {
        // Set a default profile picture and register directly
        const defaultPicture = "https://i.pinimg.com/736x/bd/46/35/bd463547b9ae986ba4d44d717828eb09.jpg";
        updateProfilePicture(defaultPicture);
        
        setIsUploading(true);
        
        try {
            console.log('Registering user with default profile picture...');
            
            // Check if this is an Apple registration or email registration
            if (onboardingData.appleId) {
                await registerWithApple(defaultPicture);
            } else {
                await registerWithEmail(defaultPicture);
            }
            
            console.log('User registered successfully!');
            showToast('Account created successfully! 🎉', 'success');
            
            // Navigate to notifications screen
            router.push('/(onboarding)/notifications');
            
        } catch (error: any) {
            console.error('Registration error:', error);
            
            let errorMessage = 'Unable to create account. Please try again.';
            
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.toString().includes('email')) {
                errorMessage = 'This email is already registered. Please use a different email.';
            } else if (error.toString().includes('handle')) {
                errorMessage = 'This handle is already taken. Please choose a different one.';
            }
            
            showToast(errorMessage, 'danger');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Background graphics */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                <OnboardingBackground />
            </View>

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
                        Add a profile photo
                    </ThemedText>
                    <ThemedText style={styles.subtitleText}>
                        Help others recognize you
                    </ThemedText>
                </Animated.View>

                {/* Photo Section */}
                <Animated.View 
                    style={[
                        styles.photoContainer,
                        {
                            opacity: fadeAnimation,
                        }
                    ]}
                >
                    <TouchableOpacity 
                        onPress={pickImage}
                        disabled={isLoading || isUploading}
                    >
                        <Image
                            source={{ uri: selectedImage || onboardingData.profilePicture }}
                            style={[
                                styles.photoImage,
                                {
                                    borderWidth: 2,
                                    borderColor: ThemedColor.text,
                                }
                            ]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={isLoading || isUploading}
                        style={[
                            styles.cameraButton,
                            {
                                backgroundColor: ThemedColor.lightened,
                                borderColor: ThemedColor.text,
                                opacity: (isLoading || isUploading) ? 0.5 : 1,
                            }
                        ]}
                    >
                        <Svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                            <Rect x="0.5" y="0.5" width="51" height="51" rx="25.5" fill={ThemedColor.lightened} />
                            <Rect x="0.5" y="0.5" width="51" height="51" rx="25.5" stroke="white" />
                            <Rect width="32" height="32" transform="translate(10 10)" fill={ThemedColor.lightened} />
                            <Path
                                d="M36 17H32.535L30.8312 14.445C30.74 14.3082 30.6164 14.196 30.4714 14.1184C30.3264 14.0408 30.1645 14.0001 30 14H22C21.8355 14.0001 21.6736 14.0408 21.5286 14.1184C21.3836 14.196 21.26 14.3082 21.1687 14.445L19.4637 17H16C15.2044 17 14.4413 17.3161 13.8787 17.8787C13.3161 18.4413 13 19.2044 13 20V34C13 34.7956 13.3161 35.5587 13.8787 36.1213C14.4413 36.6839 15.2044 37 16 37H36C36.7956 37 37.5587 36.6839 38.1213 36.1213C38.6839 35.5587 39 34.7956 39 34V20C39 19.2044 38.6839 18.4413 38.1213 17.8787C37.5587 17.3161 36.7956 17 36 17ZM37 34C37 34.2652 36.8946 34.5196 36.7071 34.7071C36.5196 34.8946 36.2652 35 36 35H16C15.7348 35 15.4804 34.8946 15.2929 34.7071C15.1054 34.5196 15 34.2652 15 34V20C15 19.7348 15.1054 19.4804 15.2929 19.2929C15.4804 19.1054 15.7348 19 16 19H20C20.1647 19.0001 20.3268 18.9595 20.4721 18.8819C20.6173 18.8043 20.7411 18.692 20.8325 18.555L22.535 16H29.4638L31.1675 18.555C31.2589 18.692 31.3827 18.8043 31.5279 18.8819C31.6732 18.9595 31.8353 19.0001 32 19H36C36.2652 19 36.5196 19.1054 36.7071 19.2929C36.8946 19.4804 37 19.7348 37 20V34ZM31 27C31 27.2652 30.8946 27.5196 30.7071 27.7071C30.5196 27.8946 30.2652 28 30 28H27V31C27 31.2652 26.8946 31.5196 26.7071 31.7071C26.5196 31.8946 26.2652 32 26 32C25.7348 32 25.4804 31.8946 25.2929 31.7071C25.1054 31.5196 25 31.2652 25 31V28H22C21.7348 28 21.4804 27.8946 21.2929 27.7071C21.1054 27.5196 21 27.2652 21 27C21 26.7348 21.1054 26.4804 21.2929 26.2929C21.4804 26.1054 21.7348 26 22 26H25V23C25 22.7348 25.1054 22.4804 25.2929 22.2929C25.4804 22.1054 25.7348 22 26 22C26.2652 22 26.5196 22.1054 26.7071 22.2929C26.8946 22.4804 27 22.7348 27 23V26H30C30.2652 26 30.5196 26.1054 30.7071 26.2929C30.8946 26.4804 31 26.7348 31 27Z"
                                fill={ThemedColor.text}
                            />
                        </Svg>
                    </TouchableOpacity>
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
                        title={isUploading ? "Uploading photo..." : isLoading ? "Creating account..." : "Complete"}
                        onPress={handleContinue}
                        disabled={isLoading || isUploading || !selectedImage}
                    />
                    <TouchableOpacity 
                        style={styles.skipButton}
                        onPress={handleSkip}
                        disabled={isLoading || isUploading}
                    >
                        <ThemedText style={[styles.skipText, { color: ThemedColor.primary, opacity: (isLoading || isUploading) ? 0.5 : 1 }]}>
                            Skip for now
                        </ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.15,
        justifyContent: 'space-between',
        paddingBottom: 40,
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
    photoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -60,
    },
    photoImage: {
        width: 216,
        height: 216,
        borderRadius: 3000,
    },
    cameraButton: {
        position: 'absolute',
        left: screenWidth / 2 - HORIZONTAL_PADDING,
        marginTop: 216,
        borderRadius: 100,
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    skipButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '500',
    },
});

export default PhotoOnboarding;
