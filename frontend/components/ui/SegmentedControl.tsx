import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";

interface SegmentedControlProps {
    options: string[];
    selectedOption: string;
    onOptionPress: (option: string) => void;
    size?: 'default' | 'small';
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, selectedOption, onOptionPress, size = 'default' }) => {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
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

    const isSmall = size === 'small';

    return (
        <View 
            style={[
                styles.container, 
                { backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary, borderWidth: 1 },
                isSmall && styles.containerSmall
            ]}
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
                        style={isSmall && styles.textSmall}
                    >
                        {option}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const stylesheet = (ThemedColor: any) => StyleSheet.create({
    container: {
        flexDirection: "row",
        borderRadius: 18,
        position: "relative",
        overflow: "hidden",
        marginTop: 12,
        paddingVertical: 16,
        width: "100%", // Ensure it takes full available width
    },
    containerSmall: {
        paddingVertical: 24,
        borderRadius: 24,
    },
    activeBox: {
        position: "absolute",
        top: 2,
        bottom: 2,
        left: 0,
        borderRadius: 24,
        marginHorizontal: 2, // Creates a small gap for the 'pill' look
        borderWidth: 2,
        borderColor: ThemedColor.background, 
    },
    option: {
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    text: {
        fontSize: 14,
    },
    textSmall: {
        fontSize: 13,
    },
});

export default SegmentedControl;
