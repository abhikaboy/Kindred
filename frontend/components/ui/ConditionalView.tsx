import { StyleSheet, Text, View, Animated } from "react-native";
import React, { useEffect, useRef, useState } from "react";

type Props = {
    children: React.ReactNode;
    condition: boolean;
    animated?: boolean;
    animationDuration?: number;
    triggerDep?: any; // Dependency that triggers re-animation even if condition doesn't change
};

const ConditionalView = ({ condition, children, animated = false, animationDuration = 400, triggerDep }: Props) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const [shouldRender, setShouldRender] = useState(condition);
    const [isInitialized, setIsInitialized] = useState(false);
    const [renderedChildren, setRenderedChildren] = useState(children);
    const prevTriggerDep = useRef(triggerDep);
    const pendingChildren = useRef(children);

    useEffect(() => {
        if (!isInitialized) {
            // Set initial opacity without animation
            opacity.setValue(condition ? 1 : 0);
            setShouldRender(condition);
            setRenderedChildren(children);
            pendingChildren.current = children;
            setIsInitialized(true);
            prevTriggerDep.current = triggerDep;
            return;
        }

        const triggerDepChanged = triggerDep !== prevTriggerDep.current;

        // Capture new children when triggerDep changes
        if (triggerDepChanged) {
            pendingChildren.current = children;
        }

        prevTriggerDep.current = triggerDep;

        if (animated) {
            if (condition) {
                // Fade in: render immediately, then animate
                setShouldRender(true);

                // If triggerDep changed but condition stayed true, fade out old content then fade in new
                if (triggerDepChanged) {
                    // First fade out to 40%
                    Animated.timing(opacity, {
                        toValue: 0.4,
                        duration: animationDuration / 2,
                        useNativeDriver: true,
                    }).start(() => {
                        // Update content with the captured pending children and fade in from 40%
                        setRenderedChildren(pendingChildren.current);
                        // Use requestAnimationFrame to ensure React has rendered the new content
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                // Ensure we start from 40% opacity
                                opacity.setValue(0.4);
                                Animated.timing(opacity, {
                                    toValue: 1,
                                    duration: animationDuration / 2,
                                    useNativeDriver: true,
                                }).start();
                            });
                        });
                    });
                } else {
                    // Normal fade in (condition changed from false to true)
                    setRenderedChildren(children);
                    pendingChildren.current = children;
                    opacity.setValue(0); // Ensure we start from 0 opacity
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: animationDuration,
                        useNativeDriver: true,
                    }).start();
                }
            } else {
                // Fade out: animate to 40% opacity, then remove from render
                Animated.timing(opacity, {
                    toValue: 0.4,
                    duration: animationDuration,
                    useNativeDriver: true,
                }).start(() => {
                    setShouldRender(false);
                });
            }
        } else {
            setShouldRender(condition);
            setRenderedChildren(children);
        }
    }, [condition, animated, animationDuration, isInitialized, triggerDep]);

    if (!shouldRender) {
        return null;
    }

    if (animated) {
        return <Animated.View style={{ opacity }}>{renderedChildren}</Animated.View>;
    }

    return children;
};

export default ConditionalView;
