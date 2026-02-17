import React from "react";
import { TouchableWithoutFeedback, Animated, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

interface FABBackdropProps {
    visible: boolean;
    opacity: Animated.Value;
    onPress: () => void;
}

export const FABBackdrop: React.FC<FABBackdropProps> = ({ visible, opacity, onPress }) => {
    if (!visible) return null;

    return (
        <TouchableWithoutFeedback onPress={onPress}>
            <Animated.View
                style={[
                    styles.backdrop,
                    {
                        opacity,
                    },
                ]}
            >
                <BlurView intensity={15} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 998,
    },
});
