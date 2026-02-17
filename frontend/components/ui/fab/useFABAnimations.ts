import { useRef } from "react";
import { Animated, Easing } from "react-native";

export const useFABAnimations = () => {
    // Main FAB animations
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fabScale = useRef(new Animated.Value(1)).current;
    const fabOpacity = useRef(new Animated.Value(1)).current;

    // Menu animations
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const menuOpacity = useRef(new Animated.Value(0)).current;
    const menuTranslateY = useRef(new Animated.Value(30)).current;
    const menuHeight = useRef(new Animated.Value(0)).current;

    // Menu content animations
    const taskSelectionOpacity = useRef(new Animated.Value(1)).current;
    const workspaceSelectionOpacity = useRef(new Animated.Value(0)).current;
    const postTaskSelectionOpacity = useRef(new Animated.Value(0)).current;

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "45deg"],
    });

    const animateFABPress = () => {
        return Animated.sequence([
            Animated.timing(fabScale, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(fabScale, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]);
    };

    const animateOpen = () => {
        // Reset values
        taskSelectionOpacity.setValue(1);
        workspaceSelectionOpacity.setValue(0);
        postTaskSelectionOpacity.setValue(0);
        menuOpacity.setValue(0);
        menuTranslateY.setValue(30);
        backdropOpacity.setValue(0);

        return Animated.parallel([
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(menuOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(menuTranslateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]);
    };

    const animateClose = (onComplete?: () => void) => {
        return Animated.parallel([
            Animated.timing(rotateAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(menuOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(menuTranslateY, {
                toValue: 30,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Reset all animations
            taskSelectionOpacity.setValue(1);
            workspaceSelectionOpacity.setValue(0);
            postTaskSelectionOpacity.setValue(0);
            onComplete?.();
        });
    };

    const animateToWorkspaceView = (fromHeight: number, toHeight: number) => {
        menuHeight.setValue(fromHeight);

        return Animated.parallel([
            Animated.timing(menuHeight, {
                toValue: toHeight,
                duration: 250,
                easing: Easing.ease,
                useNativeDriver: false,
            }),
            Animated.timing(taskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(workspaceSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]);
    };

    const animateToPostTaskView = (fromHeight: number, toHeight: number) => {
        menuHeight.setValue(fromHeight);

        return Animated.parallel([
            Animated.timing(menuHeight, {
                toValue: toHeight,
                duration: 250,
                easing: Easing.ease,
                useNativeDriver: false,
            }),
            Animated.timing(taskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(postTaskSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]);
    };

    const animateBackToTaskView = (fromHeight: number, toHeight: number) => {
        menuHeight.setValue(fromHeight);

        return Animated.parallel([
            Animated.timing(menuHeight, {
                toValue: toHeight,
                duration: 300,
                useNativeDriver: false,
            }),
            Animated.timing(workspaceSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(postTaskSelectionOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(taskSelectionOpacity, {
                toValue: 1,
                duration: 200,
                delay: 100,
                useNativeDriver: true,
            }),
        ]);
    };

    const animateKeyboardShow = () => {
        return Animated.timing(fabOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        });
    };

    const animateKeyboardHide = () => {
        return Animated.timing(fabOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        });
    };

    return {
        // Values
        rotation,
        fabScale,
        fabOpacity,
        backdropOpacity,
        menuOpacity,
        menuTranslateY,
        menuHeight,
        taskSelectionOpacity,
        workspaceSelectionOpacity,
        postTaskSelectionOpacity,

        // Animation functions
        animateFABPress,
        animateOpen,
        animateClose,
        animateToWorkspaceView,
        animateToPostTaskView,
        animateBackToTaskView,
        animateKeyboardShow,
        animateKeyboardHide,
    };
};
