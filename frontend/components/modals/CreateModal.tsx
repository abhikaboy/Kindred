import { Dimensions, StyleSheet } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useThemeColor } from "@/hooks/useThemeColor";
import Standard from "./create/Standard";
import NewCategory from "./create/NewCategory";
import SelectWorkspace from "./create/SelectWorkspace";
import Deadline from "./create/Deadline";
import Recurring from "./create/Recurring";
import StartDate from "./create/StartDate";
import Reminder from "./create/Reminder";
import Collaborators from "./create/Collaborators";
import Integration from "./create/Integration";
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetScrollView,
    useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { useTaskCreation } from "@/contexts/taskCreationContext";

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
    tutorial?: boolean; // Onboarding tutorial: lock the task name + hide the tag option
};

export enum Screen {
    STANDARD,
    NEW_CATEGORY,
    EDIT,
    DEADLINE,
    RECURRING,
    STARTDATE,
    REMINDER,
    COLLABORATORS,
    INTEGRATION,
    SELECT_WORKSPACE,
}

const CreateModal = (props: Props) => {
    const [screen, setScreen] = useState(props.screen ?? Screen.STANDARD);
    const ThemedColor = useThemeColor();

    // Only the setter: subscribing to taskName here re-rendered the whole sheet on
    // every keystroke. Each screen reads what it needs from the context directly.
    const { setCopySourceTaskId } = useTaskCreation();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // NEW_CATEGORY needs enough height to clear the software keyboard for its
    // autofocused input; the rest of the screens use the tall sheet.
    const snapPoints = useMemo(
        () => (screen === Screen.NEW_CATEGORY ? ["50%"] : ["90%"]),
        [screen]
    );

    const goToScreen = useCallback((newScreen: Screen) => {
        setScreen(newScreen);
    }, []);

    // gorhom's default spring is heavily overdamped (damping 500 / stiffness 1000 / mass 3)
    // and leans on restDisplacementThreshold to cut the tail — a key Reanimated 4 dropped,
    // so the sheet now crawls its full settle in both directions. Critically damped instead.
    const animationConfigs = useBottomSheetSpringConfigs({
        duration: 250,
        dampingRatio: 1,
        overshootClamping: true,
    });

    // Present as soon as we're visible. The ref is set before effects run and a
    // freshly mounted sheet is never presented, so no delay or pre-dismiss is needed.
    useEffect(() => {
        if (!props.visible) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        bottomSheetModalRef.current?.present();
    }, [props.visible]);

    // The single "sheet is fully closed" hook, for every close path: swipe down,
    // backdrop, or the Create button. Runs after the animation, never during it.
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index !== -1) return;
            // A cancelled copy must not mark the tag "copied" on a later create
            setCopySourceTaskId(null);
            setScreen(props.screen ?? Screen.STANDARD);
            props.setVisible(false);
        },
        [props.setVisible, props.screen, setCopySourceTaskId]
    );

    // Controlled use (onboarding tutorial) drives closing through `visible`
    useEffect(() => {
        if (!props.visible) bottomSheetModalRef.current?.dismiss();
    }, [props.visible]);

    // Re-snap only on a real screen change: NEW_CATEGORY is a shorter sheet. Firing
    // this on mount raced the present() animation to the same index.
    const snappedForScreen = useRef(screen);
    useEffect(() => {
        if (snappedForScreen.current === screen) return;
        snappedForScreen.current = screen;
        if (props.visible) bottomSheetModalRef.current?.snapToIndex(0);
    }, [screen, props.visible]);

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    const goToStandard = useCallback(() => setScreen(Screen.STANDARD), []);

    // Dismiss rather than unmount, so tapping Create animates out like a swipe down
    // does. handleSheetChanges then clears state once the animation lands.
    const hideModal = useCallback(() => bottomSheetModalRef.current?.dismiss(), []);

    // Memoize screen props to prevent unnecessary re-renders
    const screenProps = useMemo(() => ({ goToStandard }), [goToStandard]);

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
                        tutorial={props.tutorial}
                    />
                );
            case Screen.NEW_CATEGORY:
                return (
                    <NewCategory {...screenProps} goToStandard={goToStandard} isBlueprint={props.isBlueprint} />
                );
            case Screen.SELECT_WORKSPACE:
                return <SelectWorkspace goTo={goToScreen} />;
            case Screen.DEADLINE:
                return <Deadline {...screenProps} />;
            case Screen.RECURRING:
                return <Recurring {...screenProps} />;
            case Screen.STARTDATE:
                return <StartDate {...screenProps} />;
            case Screen.REMINDER:
                return <Reminder {...screenProps} />;
            case Screen.COLLABORATORS:
                return <Collaborators {...screenProps} />;
            case Screen.INTEGRATION:
                return <Integration goTo={goToScreen} />;
            default:
                return null;
        }
    }, [
        screen,
        screenProps,
        goToScreen,
        props.edit,
        props.categoryId,
        props.isBlueprint,
        props.tutorial,
        hideModal,
        goToStandard,
    ]);

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            animationConfigs={animationConfigs}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}
            enableDynamicSizing={false}
            keyboardBehavior="interactive"
            android_keyboardInputMode="adjustResize">
            <BottomSheetScrollView
                style={[
                    styles.container,
                    {
                        backgroundColor: ThemedColor.background,
                        minHeight: screen === Screen.NEW_CATEGORY ? undefined : Dimensions.get('window').height * 0.8,
                        padding: screen === Screen.NEW_CATEGORY ? 16 : 24,
                    },
                ]}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled">
                {currentScreenComponent}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 8,
        width: "100%",
    },
});

export default CreateModal;
