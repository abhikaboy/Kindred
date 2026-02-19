import React from "react";
import { TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Plus, X, Camera } from "phosphor-react-native";

interface FABButtonProps {
    isOpen: boolean;
    onPress: () => void;
    rotation: Animated.AnimatedInterpolation<string | number>;
    scale: Animated.Value;
    opacity: Animated.Value;
    bottomOffset: number;
    isKeyboardVisible: boolean;
    isOnFeedTab?: boolean;
}

export const FABButton: React.FC<FABButtonProps> = ({
    isOpen,
    onPress,
    rotation,
    scale,
    opacity,
    bottomOffset,
    isKeyboardVisible,
    isOnFeedTab,
}) => {
    return (
        <Animated.View
            style={[
                styles.fab,
                {
                    bottom: bottomOffset,
                    transform: [{ rotate: rotation }, { scale }],
                    opacity,
                },
            ]}
            pointerEvents={isKeyboardVisible ? "none" : "auto"}
        >
            <TouchableOpacity
                style={styles.fabButton}
                onPress={onPress}
                activeOpacity={0.8}
            >
                {isOpen ? (
                    <X size={24} color="#FFFFFF" weight="bold" />
                ) : isOnFeedTab ? (
                    <Camera size={24} color="#FFFFFF" weight="bold" />
                ) : (
                    <Plus size={24} color="#FFFFFF" weight="bold" />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#854DFF",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
    },
    fabButton: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 28,
    },
});
