import React, { useEffect, useState } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions, Modal } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Pencil, Alarm, CheckCircle, Sparkle, Fire, Star, Atom } from "phosphor-react-native";

type Props = {
    message?: string;
    submessage?: string;
};

const LOADING_ICONS = [
    Pencil,
    Alarm,
    CheckCircle,
    Sparkle,
    Fire,
    Star,
    Atom,
];

export const TaskGenerationLoading = ({ 
    message = "Processing with AI...", 
    submessage = "This may take a few moments" 
}: Props) => {
    const ThemedColor = useThemeColor();
    const [currentIconIndex, setCurrentIconIndex] = useState(0);
    const [fadeAnim] = useState(new Animated.Value(1));
    const [scaleAnim] = useState(new Animated.Value(1));
    const [rotateAnim] = useState(new Animated.Value(0));
    const [bounceAnim] = useState(new Animated.Value(0));
    const [glowAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        // Continuous subtle bounce animation
        const bounceLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnim, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        bounceLoop.start();

        // Continuous glow pulse animation
        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false, // opacity in styles needs this
                }),
                Animated.timing(glowAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ])
        );
        glowLoop.start();

        const interval = setInterval(() => {
            // Fade out, scale down, and rotate
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.5,
                    duration: 250,
                    easing: Easing.in(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 250,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // Change icon
                setCurrentIconIndex((prev) => (prev + 1) % LOADING_ICONS.length);
                
                // Reset rotation
                rotateAnim.setValue(0);
                
                // Fade in, scale up with bounce, and rotate back
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 350,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 4,
                        tension: 80,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
        }, 900); // Change icon every 900ms

        return () => {
            clearInterval(interval);
            bounceLoop.stop();
            glowLoop.stop();
        };
    }, [fadeAnim, scaleAnim, rotateAnim, bounceAnim, glowAnim]);

    const CurrentIcon = LOADING_ICONS[currentIconIndex];
    
    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const translateY = bounceAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
    });

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
    });

    const { width, height } = Dimensions.get('screen');

    return (
        <>
            {/* Purple glow borders - rendered in Modal to overlay entire screen */}
            <Modal
                visible={true}
                transparent={true}
                animationType="none"
                statusBarTranslucent={true}
                presentationStyle="overFullScreen"
                pointerEvents="none"
            >
                <View style={styles.modalOverlay} pointerEvents="none">
                    <Animated.View 
                        style={[
                            styles.glowTop,
                            { 
                                width,
                                opacity: glowOpacity,
                            }
                        ]} 
                    />
                    <Animated.View 
                        style={[
                            styles.glowBottom,
                            { 
                                width,
                                opacity: glowOpacity,
                            }
                        ]} 
                    />
                    <Animated.View 
                        style={[
                            styles.glowLeft,
                            { 
                                height,
                                opacity: glowOpacity,
                            }
                        ]} 
                    />
                    <Animated.View 
                        style={[
                            styles.glowRight,
                            { 
                                height,
                                opacity: glowOpacity,
                            }
                        ]} 
                    />
                </View>
            </Modal>

            <View style={styles.loadingContainer}>
            <Animated.View
                style={[
                    styles.iconContainer,
                    {
                        opacity: fadeAnim,
                        transform: [
                            { scale: scaleAnim },
                            { rotate: rotation },
                            { translateY: translateY },
                        ],
                    },
                ]}
            >
                <CurrentIcon 
                    size={56} 
                    color={ThemedColor.primary}
                    weight="duotone"
                />
            </Animated.View>
            <ThemedText 
                type="default" 
                style={[styles.loadingText, { color: ThemedColor.caption }]}>
                {message}
            </ThemedText>
            <ThemedText 
                type="default" 
                style={[styles.loadingSubtext, { color: ThemedColor.caption }]}>
                {submessage}
            </ThemedText>
        </View>
        </>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
        gap: 12,
    },
    iconContainer: {
        marginBottom: 8,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: "500",
    },
    loadingSubtext: {
        fontSize: 14,
    },
    glowTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: 2,
        backgroundColor: '#a855f7',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 30,
        zIndex: 9999,
    },
    glowBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 2,
        backgroundColor: '#a855f7',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 30,
        zIndex: 9999,
    },
    glowLeft: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 2,
        backgroundColor: '#a855f7',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 30,
        zIndex: 9999,
    },
    glowRight: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 2,
        backgroundColor: '#a855f7',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 30,
        zIndex: 9999,
    },
});

