import { StyleSheet, Text, View, Animated, StyleProp, ViewStyle } from "react-native";
import React, { useEffect, useRef, useState } from "react";

type Props = {
    children: React.ReactNode;
    condition: boolean;
    animated?: boolean;
    animationDuration?: number;
    triggerDep?: any; // Dependency that triggers re-animation even if condition doesn't change
    style?: StyleProp<ViewStyle>;
};

const ConditionalView = ({
    condition,
    children,
    animated = false,
    animationDuration = 400,
    triggerDep,
    style,
}: Props) => {
    const opacity = useRef(new Animated.Value(condition ? 1 : 0)).current;
    const [shouldRender, setShouldRender] = useState(condition);
    const prevCondition = useRef(condition);

    useEffect(() => {
        if (condition) {
            setShouldRender(true);
            if (animated) {
                opacity.setValue(0);
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: animationDuration,
                    useNativeDriver: true,
                }).start();
            }
        } else if (prevCondition.current) {
            // Only animate out if previously rendered
            if (animated) {
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: animationDuration,
                    useNativeDriver: true,
                }).start(() => {
                    setShouldRender(false);
                });
            } else {
                setShouldRender(false);
            }
        }
        prevCondition.current = condition;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [condition, triggerDep, animated, animationDuration]);

    if (!shouldRender) {
        return null;
    }

    if (animated) {
        return (
            <Animated.View key={triggerDep} style={[{ opacity }, style]}>
                {children}
            </Animated.View>
        );
    }

    return <>{children}</>;
};

export default ConditionalView;
