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
    // Lazy-init: `useRef(new Animated.Value())` would allocate on every render.
    const opacityRef = useRef<Animated.Value | null>(null);
    if (opacityRef.current === null) opacityRef.current = new Animated.Value(condition ? 1 : 0);
    const opacity = opacityRef.current;
    const [shouldRender, setShouldRender] = useState(condition);
    const prevCondition = useRef(condition);

    useEffect(() => {
        // Non-animated views render straight off `condition` below; no state to sync.
        if (!animated) {
            prevCondition.current = condition;
            return;
        }
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

    if (!animated) {
        return condition ? <>{children}</> : null;
    }

    if (!shouldRender) {
        return null;
    }

    return (
        <Animated.View key={triggerDep} style={[{ opacity }, style]}>
            {children}
        </Animated.View>
    );
};

export default ConditionalView;
