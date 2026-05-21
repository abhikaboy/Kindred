import React, { useEffect, useRef, useState } from "react";
import { TouchableWithoutFeedback, Animated, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

const MAX_BLUR_INTENSITY = 20;

interface RingsBlurOverlayProps {
    visible: boolean;
    onDismiss: () => void;
}

const RingsBlurOverlay: React.FC<RingsBlurOverlayProps> = ({ visible, onDismiss }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const runningAnim = useRef<Animated.CompositeAnimation | null>(null);
    const [mounted, setMounted] = useState(false);
    const [blurIntensity, setBlurIntensity] = useState(0);

    useEffect(() => {
        const id = animValue.addListener(({ value }) => {
            setBlurIntensity(value * MAX_BLUR_INTENSITY);
        });
        return () => animValue.removeListener(id);
    }, []);

    useEffect(() => {
        // Stop any in-flight animation to prevent reverse-play artifacts
        if (runningAnim.current) {
            runningAnim.current.stop();
            runningAnim.current = null;
        }

        if (visible) {
            setMounted(true);
            const anim = Animated.timing(animValue, {
                toValue: 1,
                duration: 250,
                useNativeDriver: false,
            });
            runningAnim.current = anim;
            anim.start(() => { runningAnim.current = null; });
        } else {
            const anim = Animated.timing(animValue, {
                toValue: 0,
                duration: 250,
                useNativeDriver: false,
            });
            runningAnim.current = anim;
            anim.start(({ finished }) => {
                runningAnim.current = null;
                if (finished) setMounted(false);
            });
        }
    }, [visible]);

    if (!mounted) return null;

    return (
        <TouchableWithoutFeedback onPress={onDismiss}>
            <View style={styles.overlay}>
                <BlurView intensity={blurIntensity} style={StyleSheet.absoluteFill} tint="default" />
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "transparent",
        zIndex: 998,
    },
});

export default RingsBlurOverlay;
