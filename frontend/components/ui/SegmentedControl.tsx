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
    /** Optional leading icon per option. Receives the resolved content color and focused state. */
    icons?: Record<string, (color: string, focused: boolean) => React.ReactNode>;
    /** Light-purple active segment with primary-colored label/icon (vs. the default gray segment). */
    accent?: boolean;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, selectedOption, onOptionPress, size = 'default', icons, accent = false }) => {
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
            translateX.value = withTiming(index * segmentWidth, {
                duration: 200,
            });
        }
    }, [selectedOption, segmentWidth, options]);

    const handlePress = (option: string) => {
        const index = options.indexOf(option);

        // Start animation immediately with optimized config
        translateX.value = withTiming(index * segmentWidth, {
            duration: 200,
        });

        // Call the handler immediately - the animation will continue independently
        onOptionPress(option);
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
                            width: segmentWidth - 8,
                            backgroundColor: accent ? ThemedColor.primary + "1F" : ThemedColor.lightened,
                        },
                        animatedStyle,
                    ]}
                />
            )}
            {options.map((option) => {
                const focused = selectedOption === option;
                const contentColor = focused && accent ? ThemedColor.primary : ThemedColor.text;
                return (
                    <TouchableOpacity
                        key={option}
                        style={[styles.option, { flex: 1 }]}
                        onPress={() => handlePress(option)}
                        activeOpacity={0.8}>
                        <View style={styles.optionContent}>
                            {icons?.[option]?.(contentColor, focused)}
                            <ThemedText
                                type={focused ? "defaultSemiBold" : "default"}
                                style={[isSmall && styles.textSmall, { color: contentColor }]}
                            >
                                {option}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const stylesheet = (ThemedColor: any) => StyleSheet.create({
    container: {
        flexDirection: "row",
        borderRadius: 24,
        position: "relative",
        overflow: "hidden",
        marginTop: 12,
        paddingVertical: 14,
        width: "100%",
    },
    containerSmall: {
        borderRadius: 24,
    },
    activeBox: {
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 0,
        borderRadius: 20,
        marginHorizontal: 0,
        borderWidth: 2,
        borderColor: ThemedColor.background,
    },
    option: {
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    optionContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    text: {
        fontSize: 14,
    },
    textSmall: {
        fontSize: 13,
    },
});

export default SegmentedControl;
