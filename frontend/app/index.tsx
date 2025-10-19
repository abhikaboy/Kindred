import React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { View, Image } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { MotiView } from 'moti';

/**
 * Entry point that determines where to route the user:
 * - First time users -> productivity onboarding
 * - Returning users without auth -> login
 * - Authenticated users -> main app
 */
export default function Index() {
    const router = useRouter();
    const { user } = useAuth();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        checkInitialRoute();
    }, []);

    const checkInitialRoute = async () => {
        try {
            // If user is authenticated, go to main app
            if (user) {
                console.log('User is authenticated, going to main app');
                router.replace('/(logged-in)/(tabs)/(task)');
                return;
            }

            // Check if user has seen onboarding screens
            const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
            console.log('hasSeenOnboarding', hasSeenOnboarding);
            if (!hasSeenOnboarding) {
                // First time user - show productivity onboarding
                console.log('First time user, showing productivity onboarding');
                router.replace('/(onboarding)/productivity');
            } else {
                // Returning user - go to login
                console.log('Returning user, going to login');
                router.replace('/login');
            }
        } catch (error) {
            console.error('Error checking initial route:', error);
            // Default to login on error
            router.replace('/login');
        } finally {
            setIsChecking(false);
        }
    };

    // Show loading state while checking
    if (isChecking) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        type: 'timing',
                        duration: 500,
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                >
                    <Image
                        source={require('@/assets/splash-icon.png')}
                        style={{
                            width: 120,
                            height: 120,
                            resizeMode: 'contain',
                        }}
                    />
                </MotiView>
            </ThemedView>
        );
    }

    return null;
}

