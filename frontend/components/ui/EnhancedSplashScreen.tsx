import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native';
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
 * - Expanding circles that transition from purple to white
 * - Smooth swipe exit transition
 * 
 * @param onAnimationComplete - Callback fired when entrance animation completes
 * @param minDisplayTime - Minimum time to show splash screen (default: 2500ms)
 */
export default function EnhancedSplashScreen({ 
    onAnimationComplete,
    minDisplayTime = 2500 
}: EnhancedSplashScreenProps) {
    const ThemedColor = useThemeColor();
    const [animationComplete, setAnimationComplete] = useState(false);
    const [startExit, setStartExit] = useState(false);
    
    // Animation values
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeOutAnim = useRef(new Animated.Value(1)).current;

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
            }, 1000); // Wait for circles to expand
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
        <Animated.View 
            style={[
                styles.container, 
                { 
                    backgroundColor: ThemedColor.primary,
                    opacity: fadeOutAnim,
                }
            ]}>
            {/* Expanding circles from bottom - purple to white gradient */}
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 1000 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: '#A67FFF', // Lighter purple (between primary and white)
                }]}
            />
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 1000 : 0,
                    delay: startExit ? 150 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: '#D4C5FF', // Even lighter purple (more white)
                }]}
            />
            <MotiView
                from={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: startExit ? 100 : 0, opacity: startExit ? 1 : 0.8 }}
                transition={{
                    type: 'timing',
                    duration: startExit ? 1000 : 0,
                    delay: startExit ? 300 : 0,
                    easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
                }}
                style={[styles.expandingCircle, { 
                    backgroundColor: '#FFFFFF', // Pure white
                }]}
            />

            {/* Animated logo */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: fadeAnim,
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
        </Animated.View>
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

