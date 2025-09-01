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
    screen?: Screen;
    categoryId?: string; // Category ID for editing tasks
    focused?: string;
    setFocused?: (focused: string) => void;
    blueprintConfig?: {
        blueprintName: string;
    };
    isBlueprint?: boolean; // Flag to indicate if this modal is being used for blueprint task creation
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
    const [screen, setScreen] = useState(props.screen || Screen.STANDARD);
    const ThemedColor = useThemeColor();
    const translateX = useSharedValue(0);


    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points - we'll use percentages for flexibility
    const snapPoints = useMemo(() => ["25%", "90%"], [screen]);

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

    const goToScreen = useCallback((newScreen: Screen) => {
        setScreen(newScreen);
    }, []);

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
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={1} opacity={0.5} />
        ),
        []
    );

    const goToStandard = useCallback(() => setScreen(Screen.STANDARD), []);
    
    const hideModal = useCallback(() => props.setVisible(false), [props.setVisible]);

    // Memoize screen props to prevent unnecessary re-renders
    const screenProps = useMemo(() => ({ goToStandard }), [goToStandard]);

    // Memoize the screen component to prevent recreation on every render
    const currentScreenComponent = useMemo(() => {
        switch (screen) {
            case Screen.STANDARD:
                return (
                    <Standard
                        hide={hideModal}
                        goTo={goToScreen}
                        edit={props.edit}
                        categoryId={props.categoryId}
                        isBlueprint={props.isBlueprint}
                    />
                );
            case Screen.NEW_CATEGORY:
                return (
                    <NewCategory {...screenProps} goToStandard={goToStandard} isBlueprint={props.isBlueprint} />
                );
            case Screen.DEADLINE:
                return <Deadline {...screenProps} />;
            case Screen.RECURRING:
                return <Recurring {...screenProps} />;
            case Screen.STARTDATE:
                return <StartDate {...screenProps} />;
            case Screen.STARTTIME:
                return <StartTime {...screenProps} />;
            case Screen.REMINDER:
                return <Reminder {...screenProps} />;
            case Screen.COLLABORATORS:
                return <Collaborators {...screenProps} />;
            default:
                return null;
        }
    }, [screen, screenProps, goToScreen, props.edit, props.categoryId, props.isBlueprint, hideModal, goToStandard]);

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={1}
            enableDynamicSizing={true}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetView style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <PanGestureHandler onGestureEvent={gestureHandler}>
                    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                        {currentScreenComponent}
                    </Animated.View>
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
        minHeight: Dimensions.get('window').height * 0.8, // Ensure minimum height to force 90% expansion
    },
});

export default CreateModal;
