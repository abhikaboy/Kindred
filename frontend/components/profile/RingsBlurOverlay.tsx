import React, { useEffect, useRef } from "react";
import { TouchableWithoutFeedback, Animated, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

interface RingsBlurOverlayProps {
    visible: boolean;
    onDismiss: () => void;
}

const RingsBlurOverlay: React.FC<RingsBlurOverlayProps> = ({ visible, onDismiss }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    if (!visible) return null;

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
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 998,
    },
});

export default RingsBlurOverlay;
