import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Dimensions, useColorScheme } from 'react-native';
import { Easing as RNEasing } from 'react-native';
import { Easing as ReanimatedEasing } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useThemeColor } from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EnhancedSplashScreenProps {
    onAnimationComplete?: () => void;
    minDisplayTime?: number; // Minimum time to display splash (ms)
}

/**
 * Enhanced splash screen with interesting animations
 * - Primary color background
 * - Gentle logo entrance with subtle float
 * - Expanding circles that transition to themed background (darker in dark mode, lighter in light mode)
 * - Smooth exit transition
 * 
 * @param onAnimationComplete - Callback fired when entrance animation completes
 * @param minDisplayTime - Minimum time to show splash screen (default: 2000ms)
 */
export default function EnhancedSplashScreen({ 
    onAnimationComplete,
    minDisplayTime = 2000 
}: EnhancedSplashScreenProps) {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();
    const [animationComplete, setAnimationComplete] = useState(false);
    const [startExit, setStartExit] = useState(false);
    
    // Detect dark mode
    const isDarkMode = colorScheme === 'dark';
    
    // Animation values
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeOutAnim = useRef(new Animated.Value(1)).current;
    const logoFadeOutAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const startTime = Date.now();
        
        // Initial fade in and scale up
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
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

        // Gentle floating animation
        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8,
                    duration: 1500,
                    easing: RNEasing.inOut(RNEasing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    easing: RNEasing.inOut(RNEasing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        setTimeout(() => {
            floatLoop.start();
        }, 600);

        // Start exit animation earlier (500ms before minDisplayTime ends)
        const timer = setTimeout(() => {
            floatLoop.stop();
            setStartExit(true);
            
            // Start fading out the logo immediately when circles start
            Animated.timing(logoFadeOutAnim, {
                toValue: 0,
                duration: 800,
                easing: RNEasing.out(RNEasing.ease),
                useNativeDriver: true,
            }).start();
            
            // Wait for circles to expand (now 1000ms), then fade out everything
            setTimeout(() => {
                Animated.timing(fadeOutAnim, {
                    toValue: 0,
                    duration: 300,
                    easing: RNEasing.out(RNEasing.ease),
                    useNativeDriver: true,
                }).start(() => {
                    setAnimationComplete(true);
                });
            }, 1500); // Wait for circles to expand
        }, minDisplayTime - 500); // Start 500ms earlier

        return () => {
            floatLoop.stop();
            clearTimeout(timer);
        };
    }, [minDisplayTime]);

    // Call onAnimationComplete when animation is done
    useEffect(() => {
        if (animationComplete && onAnimationComplete) {
            onAnimationComplete();
        }
    }, [animationComplete, onAnimationComplete]);

    return (
        <View 
            style={[
                styles.container, 
                { 
                    backgroundColor: ThemedColor.primary,
                }
            ]}>
            {/* Expanding circles from bottom - transition to themed background */}
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 2000 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: isDarkMode ? '#4A1F8F' : '#A67FFF', // Darker purple in dark mode, lighter in light mode
                }]}
            />
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 2000 : 0,
                    delay: startExit ? 150 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: isDarkMode ? '#1A1A1A' : '#D4C5FF', // Dark gray in dark mode, light purple in light mode
                }]}
            />
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 2000 : 0,
                    delay: startExit ? 300 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: ThemedColor.background, // Final themed background
                }]}
            />

            {/* Animated logo */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: Animated.multiply(fadeAnim, logoFadeOutAnim),
                        transform: [
                            { scale: scaleAnim },
                            { translateY: floatAnim },
                        ],
                    },
                ]}>
                <Image
                    source={require('@/assets/splash-icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>
            
            {/* Fade out overlay - only fades the entire splash at the very end */}
            <Animated.View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: ThemedColor.background,
                        opacity: Animated.subtract(1, fadeOutAnim),
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    expandingCircle: {
        position: 'absolute',
        width: SCREEN_HEIGHT * 0.3,
        height: SCREEN_HEIGHT * 0.3,
        borderRadius: SCREEN_HEIGHT * 0.15,
        bottom: -SCREEN_HEIGHT * 0.15,
    },
    logoContainer: {
        zIndex: 10,
    },
    logo: {
        width: 120,
        height: 120,
    },
});

