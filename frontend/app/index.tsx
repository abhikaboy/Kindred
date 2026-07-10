import React from 'react';
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOptionalAuth } from '@/hooks/useAuth';
import EnhancedSplashScreen from '@/components/ui/EnhancedSplashScreen';

/**
 * Entry point that determines where to route the user:
 * - First time users -> productivity onboarding
 * - Returning users without auth -> login
 * - Authenticated users -> main app
 */
export default function Index() {
    const router = useRouter();
    const auth = useOptionalAuth();
    const user = auth?.user ?? null;
    const [isChecking, setIsChecking] = useState(true);
    const [nextRoute, setNextRoute] = useState<Href | null>(null);
    const [canTransition, setCanTransition] = useState(false);

    useEffect(() => {
        checkInitialRoute();
    }, []);

    const checkInitialRoute = async () => {
        try {
            // If user is authenticated, go to main app
            if (user) {
                setNextRoute('/(logged-in)/(tabs)/(task)');
                return;
            }

            // First open ever: full-screen intro video, then login
            const hasSeenIntro = await AsyncStorage.getItem('hasSeenIntroVideo');
            if (!hasSeenIntro) {
                setNextRoute('/intro');
                return;
            }

            // Check if user has seen onboarding screens
            const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
            if (!hasSeenOnboarding) {
                // First time user - show productivity onboarding
                setNextRoute('/(onboarding)/productivity');
            } else {
                // Returning user - go to login
                setNextRoute('/login');
            }
        } catch (error) {
            console.error('Error checking initial route:', error);
            // Default to login on error
            setNextRoute('/login');
        } finally {
            setIsChecking(false);
        }
    };

    // Navigate once both route is determined and animation is complete
    useEffect(() => {
        if (nextRoute && canTransition) {
            router.replace(nextRoute);
        }
    }, [nextRoute, canTransition]);

    const handleAnimationComplete = () => {
        setCanTransition(true);
    };

    // Show splash screen while checking or waiting for animation
    if (isChecking || !canTransition) {
        return <EnhancedSplashScreen onAnimationComplete={handleAnimationComplete} />;
    }

    return null;
}
