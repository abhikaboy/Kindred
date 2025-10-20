import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

interface UseMediaLibraryResult {
    pickImage: (options?: ImagePicker.ImagePickerOptions) => Promise<ImagePicker.ImagePickerResult | null>;
    requestPermission: () => Promise<boolean>;
    checkPermission: () => Promise<boolean>;
    isLoading: boolean;
}

/**
 * Hook for handling media library permissions and image picking
 * Automatically requests permissions if not granted and provides helpful error messages
 */
export const useMediaLibrary = (): UseMediaLibraryResult => {
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Check current permission status
     */
    const checkPermission = async (): Promise<boolean> => {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        return status === 'granted';
    };

    /**
     * Request media library permission with user-friendly prompts
     */
    const requestPermission = async (): Promise<boolean> => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (status === 'granted') {
                return true;
            }
            
            // Permission denied - on iOS, if the user previously denied, the system won't show
            // the dialog again, so we need to guide them to settings
            if (status === 'denied') {
                // Check if this is a "permanent" denial (user needs to go to settings)
                // On iOS, canAskAgain is always false after first denial
                const { canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
                
                if (!canAskAgain) {
                    // User previously denied - need to go to settings
                    Alert.alert(
                        'Camera Roll Access Required',
                        'Kindred needs access to your photos to upload images. Please enable camera roll access in your device settings.',
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
                                },
                            },
                        ]
                    );
                }
                return false;
            }
            
            return false;
        } catch (error) {
            console.error('Error requesting media library permission:', error);
            Alert.alert('Error', 'Failed to request camera roll permission. Please try again.');
            return false;
        }
    };

    /**
     * Pick an image from the media library
     * Automatically handles permission checking and requesting
     */
    const pickImage = async (
        options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        }
    ): Promise<ImagePicker.ImagePickerResult | null> => {
        try {
            setIsLoading(true);

            // Check if we already have permission
            const hasPermission = await checkPermission();
            
            if (!hasPermission) {
                // Request permission if we don't have it
                const granted = await requestPermission();
                if (!granted) {
                    setIsLoading(false);
                    return null;
                }
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync(options);
            
            setIsLoading(false);
            return result;
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
            setIsLoading(false);
            return null;
        }
    };

    return {
        pickImage,
        requestPermission,
        checkPermission,
        isLoading,
    };
};

