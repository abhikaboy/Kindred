import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/useThemeColor';

type Props = {
    currentStep: number;
    totalSteps: number;
};

const OnboardingProgressBar = ({ currentStep, totalSteps }: Props) => {
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const progress = Math.min(Math.max(currentStep / totalSteps, 0), 1);
        Animated.timing(widthAnim, {
            toValue: progress * 100,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentStep, totalSteps]);

    const animatedWidth = widthAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.container, { top: insets.top }]}>
            <View style={[styles.track, { backgroundColor: ThemedColor.tertiary + '33' }]}>
                <Animated.View
                    style={[
                        styles.fill,
                        {
                            width: animatedWidth,
                            backgroundColor: ThemedColor.primary,
                        },
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 2,
        paddingHorizontal: 0,
    },
    track: {
        height: 3,
        width: '100%',
        borderRadius: 1.5,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 1.5,
    },
});

export default OnboardingProgressBar;
