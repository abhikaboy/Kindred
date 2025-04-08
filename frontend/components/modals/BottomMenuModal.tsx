import { Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React, { useEffect, useRef, memo } from "react";
import Modal from "react-native-modal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import Feather from "@expo/vector-icons/Feather";
import ModalHead from "./ModalHead";
import Animated, { useSharedValue, withTiming, useAnimatedStyle, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type ID = {
    id: string;
    category: string;
};

type BottomMenuOption = {
    label: string;
    icon: any;
    callback: () => void;
};

type Props = {
    id: ID;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    options: BottomMenuOption[];
};

// Using memo to prevent unnecessary re-renders
const BottomMenuModal = memo((props: Props) => {
    const ThemedColor = useThemeColor();
    const position = useSharedValue(0);

    // Reset position when visibility changes
    useEffect(() => {
        if (props.visible && position.value > 0) {
            position.value = withTiming(0, { duration: 100 });
        }
    }, [props.visible]);

    // Safe way to update parent state
    const closeModal = () => {
        if (props.visible) {
            props.setVisible(false);
        }
    };

    const pan = Gesture.Pan()
        .onBegin(() => {
            position.value = withTiming(0, { duration: 100 });
        })
        .onUpdate((e) => {
            position.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
            if (e.translationY > 10) {
                position.value = withTiming(500, { duration: 100 });

                // Use runOnJS to safely call JavaScript functions from the UI thread
                runOnJS(closeModal)();
            } else {
                position.value = withTiming(0, { duration: 100 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: position.value }],
    }));

    // Get styles dynamically using the current theme
    const containerStyle = {
        flex: 1,
        width: Dimensions.get("screen").width,
        backgroundColor: ThemedColor.background,
        borderTopRightRadius: 24,
        borderTopLeftRadius: 24,
        bottom: -16,
        paddingBottom: Dimensions.get("screen").height * 0.1,
        paddingTop: 32,
        paddingLeft: 24,
        left: -24,
        gap: 24,
        position: "absolute",
    };

    return (
        <Modal
            onBackdropPress={closeModal}
            onBackButtonPress={closeModal}
            isVisible={props.visible}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            avoidKeyboard>
            <GestureDetector gesture={pan}>
                <Animated.View style={[containerStyle, animatedStyle]}>
                    <ModalHead />
                    {props.options.map((option, index) => {
                        return (
                            <TouchableOpacity
                                key={index}
                                style={{ flexDirection: "row", gap: 16 }}
                                onPress={() => {
                                    closeModal();
                                    // Only call the callback if it exists
                                    option.callback && option.callback();
                                }}>
                                <Feather name={option.icon} size={24} color={ThemedColor.text} />
                                <ThemedText type="default">{option.label}</ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </Animated.View>
            </GestureDetector>
        </Modal>
    );
});

export default BottomMenuModal;
