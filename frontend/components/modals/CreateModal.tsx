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
import Reminder from "./create/Reminder";
import Collaborators from "./create/Collaborators";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
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
}

const CreateModal = (props: Props) => {
    const [screen, setScreen] = useState(props.screen || Screen.STANDARD);
    const ThemedColor = useThemeColor();
    
    // Get task creation context values to include in memoization dependencies
    const { taskName, startDate, startTime, deadline, reminders, recurring } = useTaskCreation();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points - we'll use percentages for flexibility
    const snapPoints = useMemo(() => ["90%"], []);

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
    // Include task creation context values in dependencies to ensure updates are reflected
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
            case Screen.REMINDER:
                return <Reminder {...screenProps} />;
            case Screen.COLLABORATORS:
                return <Collaborators {...screenProps} />;
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
        hideModal, 
        goToStandard,
        // Include task creation context values to ensure Standard component updates when these change
        taskName,
        startDate,
        startTime,
        deadline,
        reminders,
        recurring,
    ]);

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}
            keyboardBehavior="interactive"
            android_keyboardInputMode="adjustResize">
            <BottomSheetScrollView 
                style={[styles.container, { backgroundColor: ThemedColor.background }]}
                contentContainerStyle={{ flexGrow: 1 }}>
                {currentScreenComponent}
            </BottomSheetScrollView>
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
