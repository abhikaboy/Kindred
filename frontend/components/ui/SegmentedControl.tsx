import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

interface SegmentedControlProps {
    options: string[];
    selectedOption: string;
    onOptionPress: (option: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, selectedOption, onOptionPress }) => {
    const ThemedColor = useThemeColor();
    const [containerWidth, setContainerWidth] = useState(0);
    const translateX = useSharedValue(0);

    // Calculate segment width based on measured container width
    const segmentWidth = containerWidth / options.length;

    // Sync shared value with selectedOption prop (for initial load or external changes)
    useEffect(() => {
        if (segmentWidth > 0) {
            const index = options.indexOf(selectedOption);
            translateX.value = withTiming(index * segmentWidth);
        }
    }, [selectedOption, segmentWidth, options]);

    const handlePress = (option: string) => {
        const index = options.indexOf(option);
        // Animate immediately
        translateX.value = withTiming(index * segmentWidth);
        
        // Defer state update slightly to allow animation frame to start
        requestAnimationFrame(() => {
            onOptionPress(option);
        });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    const onLayout = (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        setContainerWidth(width);
    };

    return (
        <View 
            style={[styles.container, { backgroundColor: ThemedColor.background }]} // Use tertiary for container background
            onLayout={onLayout}
        >
            {containerWidth > 0 && (
                <Animated.View
                    style={[
                        styles.activeBox,
                        {
                            width: segmentWidth - 4, // Account for margin
                            backgroundColor: ThemedColor.lightened, // Use secondaryBackground for the active tab
                        },
                        animatedStyle,
                    ]}
                />
            )}
            {options.map((option) => (
                <TouchableOpacity
                    key={option}
                    style={[styles.option, { flex: 1 }]}
                    onPress={() => handlePress(option)}
                    activeOpacity={0.8}>
                    <ThemedText
                        type={selectedOption === option ? "defaultSemiBold" : "default"}
>
                        {option}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        borderRadius: 18,
        position: "relative",
        overflow: "hidden",
        marginTop: 12,
        paddingVertical: 16,
        width: "100%", // Ensure it takes full available width
    },
    activeBox: {
        position: "absolute",
        top: 2,
        bottom: 2,
        left: 0,
        borderRadius: 16,
        marginHorizontal: 2, // Creates a small gap for the 'pill' look
        // width is set dynamically
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    option: {
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    text: {
        fontSize: 14,
    },
});

export default SegmentedControl;
