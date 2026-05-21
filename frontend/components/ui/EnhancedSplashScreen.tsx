import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { Easing as RNEasing } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

interface EnhancedSplashScreenProps {
    onAnimationComplete?: () => void;
    minDisplayTime?: number;
}

export default function EnhancedSplashScreen({
    onAnimationComplete,
    minDisplayTime = 1200
}: EnhancedSplashScreenProps) {
    const ThemedColor = useThemeColor();
    const [animationComplete, setAnimationComplete] = useState(false);

    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const fadeOutAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Logo entrance
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                easing: RNEasing.out(RNEasing.ease),
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 40,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();

        // Fade out the whole screen after minDisplayTime
        const timer = setTimeout(() => {
            Animated.timing(fadeOutAnim, {
                toValue: 0,
                duration: 300,
                easing: RNEasing.out(RNEasing.ease),
                useNativeDriver: true,
            }).start(() => {
                setAnimationComplete(true);
            });
        }, minDisplayTime);

        return () => clearTimeout(timer);
    }, [minDisplayTime]);

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
                    backgroundColor: ThemedColor.primary,
                    opacity: fadeOutAnim,
                },
            ]}>
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}>
                <Image
                    source={require('@/assets/splash-icon-dark.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>
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
