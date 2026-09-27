import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { Easing as RNEasing } from 'react-native';

// Must match the expo-splash-screen config in app.json for a seamless handoff
const SPLASH_BACKGROUND = '#13121F';

interface EnhancedSplashScreenProps {
    onAnimationComplete?: () => void;
    minDisplayTime?: number;
    /** Hold the splash until true (e.g. auth resolved), then fade out. */
    ready?: boolean;
}

export default function EnhancedSplashScreen({
    onAnimationComplete,
    minDisplayTime = 0,
    ready = true,
}: EnhancedSplashScreenProps) {
    const [animationComplete, setAnimationComplete] = useState(false);

    const fadeOutAnim = useRef(new Animated.Value(1)).current;
    const mountedAt = useRef(Date.now()).current;

    // Fade out the whole screen once ready (and after minDisplayTime, if set)
    useEffect(() => {
        if (!ready) return;
        const remaining = Math.max(0, minDisplayTime - (Date.now() - mountedAt));
        const timer = setTimeout(() => {
            Animated.timing(fadeOutAnim, {
                toValue: 0,
                duration: 200,
                easing: RNEasing.out(RNEasing.ease),
                useNativeDriver: true,
            }).start(() => {
                setAnimationComplete(true);
            });
        }, remaining);

        return () => clearTimeout(timer);
    }, [ready, minDisplayTime]);

    useEffect(() => {
        if (animationComplete && onAnimationComplete) {
            onAnimationComplete();
        }
    }, [animationComplete, onAnimationComplete]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: SPLASH_BACKGROUND,
                    opacity: fadeOutAnim,
                },
            ]}>
            {/* Static logo so the handoff from the native splash is seamless */}
            <View style={styles.logoContainer}>
                <Image
                    source={require('@/assets/splash-icon-dark.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        zIndex: 10,
    },
    logo: {
        width: 120,
        height: 120,
    },
});
