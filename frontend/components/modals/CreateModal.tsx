import { Dimensions, StyleSheet, View } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import ModalHead from "./ModalHead";
import Standard from "./create/Standard";
import ConditionalView from "../ui/ConditionalView";
import NewCategory from "./create/NewCategory";
import Deadline from "./create/Deadline";
import Recurring from "./create/Recurring";
import StartDate from "./create/StartDate";
import StartTime from "./create/StartTime";
import Reminder from "./create/Reminder";
import Collaborators from "./create/Collaborators";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
    useAnimatedGestureHandler,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    focused?: string;
    setFocused?: (focused: string) => void;
};

export enum Screen {
    STANDARD,
    NEW_CATEGORY,
    EDIT,
    DEADLINE,
    RECURRING,
    STARTDATE,
    STARTTIME,
    REMINDER,
    COLLABORATORS,
}

const CreateModal = (props: Props) => {
    const [screen, setScreen] = useState(Screen.STANDARD);
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const bottomAnchorRef = useRef<View>(null);
    const [bottomAnchorHeight, setBottomAnchorHeight] = useState(0);

    useEffect(() => {
        if (bottomAnchorRef.current) {
            bottomAnchorRef.current.measure((x, y, width, height, pageX, pageY) => {
                setBottomAnchorHeight(height);
            });
        }
    }, [bottomAnchorRef.current]);

    // Define snap points - we'll use percentages for flexibility
    const snapPoints = useMemo(() => [screen === Screen.STANDARD ? "85%" : "70%", "90%"], [screen]);

    const gestureHandler = useAnimatedGestureHandler({
        onStart: (_, ctx: any) => {
            ctx.startX = translateX.value;
        },
        onActive: (event, ctx) => {
            if (screen !== Screen.STANDARD) {
                // Only allow right swipe (back) when not on standard screen
                if (event.translationX > 0) {
                    translateX.value = ctx.startX + event.translationX;
                }
            }
        },
        onEnd: (event) => {
            if (event.translationX > 100 && screen !== Screen.STANDARD) {
                // If swiped right more than 100 units, go back
                runOnJS(setScreen)(Screen.STANDARD);
                translateX.value = 0;
            } else {
                // Reset position
                translateX.value = withSpring(0);
            }
        },
    });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    const goToScreen = (newScreen: Screen) => {
        setScreen(newScreen);
    };

    // Handle visibility changes
    useEffect(() => {
        if (props.visible) {
            try {
                bottomSheetModalRef.current?.present();
            } catch (error) {
                console.log("Error presenting bottom sheet:", error);
            }
        } else {
            try {
                bottomSheetModalRef.current?.dismiss();
            } catch (error) {
                console.log("Error dismissing bottom sheet:", error);
            }
        }
    }, [props.visible]);

    // Handle sheet changes
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && props.visible) {
                props.setVisible(false);
            }
        },
        [props.visible, props.setVisible]
    );

    // Reset screen when modal is dismissed
    useEffect(() => {
        if (!props.visible) {
            const timer = setTimeout(() => {
                setScreen(Screen.STANDARD);
                translateX.value = 0;
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [props.visible]);

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    const goToStandard = () => setScreen(Screen.STANDARD);

    const renderScreen = () => {
        const screenProps = { goToStandard };

        switch (screen) {
            case Screen.STANDARD:
                return (
                    <Animated.View style={animatedStyle}>
                        <Standard
                            hide={() => props.setVisible(false)}
                            goTo={goToScreen}
                            bottomAnchorRef={bottomAnchorRef}
                        />
                    </Animated.View>
                );
            case Screen.NEW_CATEGORY:
                return (
                    <Animated.View style={animatedStyle}>
                        <NewCategory {...screenProps} />
                    </Animated.View>
                );
            case Screen.DEADLINE:
                return (
                    <Animated.View style={animatedStyle}>
                        <Deadline {...screenProps} />
                    </Animated.View>
                );
            case Screen.RECURRING:
                return (
                    <Animated.View style={animatedStyle}>
                        <Recurring {...screenProps} />
                    </Animated.View>
                );
            case Screen.STARTDATE:
                return (
                    <Animated.View style={animatedStyle}>
                        <StartDate {...screenProps} />
                    </Animated.View>
                );
            case Screen.STARTTIME:
                return (
                    <Animated.View style={animatedStyle}>
                        <StartTime {...screenProps} />
                    </Animated.View>
                );
            case Screen.REMINDER:
                return (
                    <Animated.View style={animatedStyle}>
                        <Reminder {...screenProps} />
                    </Animated.View>
                );
            case Screen.COLLABORATORS:
                return (
                    <Animated.View style={animatedStyle}>
                        <Collaborators {...screenProps} />
                    </Animated.View>
                );
            default:
                return null;
        }
    };

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetView style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <PanGestureHandler onGestureEvent={gestureHandler}>
                    <Animated.View style={{ flex: 1 }}>{renderScreen()}</Animated.View>
                </PanGestureHandler>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        gap: 8,
        width: "100%",
    },
});

export default CreateModal;
