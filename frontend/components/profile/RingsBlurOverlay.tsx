import React, { useEffect, useRef, useState } from "react";
import { TouchableWithoutFeedback, Animated, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

interface RingsBlurOverlayProps {
    visible: boolean;
    onDismiss: () => void;
}

const RingsBlurOverlay: React.FC<RingsBlurOverlayProps> = ({ visible, onDismiss }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible]);

    if (!mounted) return null;

    return (
        <TouchableWithoutFeedback onPress={onDismiss}>
            <Animated.View style={[styles.overlay, { opacity }]}>
                <BlurView intensity={15} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>
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
