import { Animated, Dimensions } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedText } from "@/components/ThemedText";

type Props = {
    children: string;
    type?: any;
    style?: any;
    animationDuration?: number;
};

const SlidingText = ({ children, type, style, animationDuration = 300 }: Props) => {
    const slideX = useRef(new Animated.Value(0)).current;
    const [displayedText, setDisplayedText] = useState(children);
    const [isAnimating, setIsAnimating] = useState(false);
    const screenWidth = Dimensions.get("window").width;

    useEffect(() => {
        if (children !== displayedText && !isAnimating) {
            setIsAnimating(true);

            // Slide out current text to the left
            Animated.timing(slideX, {
                toValue: -screenWidth,
                duration: animationDuration / 2,
                useNativeDriver: true,
            }).start(() => {
                // Update text and slide in from the left
                setDisplayedText(children);
                slideX.setValue(-screenWidth);

                Animated.timing(slideX, {
                    toValue: 0,
                    duration: animationDuration / 2,
                    useNativeDriver: true,
                }).start(() => {
                    setIsAnimating(false);
                });
            });
        }
    }, [children, displayedText, isAnimating, animationDuration, screenWidth]);

    return (
        <Animated.View style={{ transform: [{ translateX: slideX }] }}>
            <ThemedText type={type} style={style}>
                {displayedText}
            </ThemedText>
        </Animated.View>
    );
};

export default SlidingText;
