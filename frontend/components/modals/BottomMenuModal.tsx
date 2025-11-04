import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useCallback, useEffect, useRef, memo, useMemo } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type ID = {
    id: string;
    category: string;
};

type BottomMenuOption = {
    label: string;
    icon: any;
    callback: () => void;
    labelHighlight?: string; // Optional text to highlight in primary color
};

type Props = {
    id: ID;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    options: BottomMenuOption[];
};

// Using memo to prevent unnecessary re-renders
const BottomMenuModal = memo((props: Props) => {
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Calculate snap points dynamically based on number of options
    // with a minimum height to ensure good UX
    const snapPoints = useMemo(() => {
        const baseHeight = 83 + 32; // Base height for padding
        const optionHeight = 48; // Height per option
        const totalHeight = baseHeight + props.options.length * optionHeight;
        const percentage = Math.max(30, Math.min(50, Math.ceil((totalHeight / Dimensions.get("window").height) * 100)));
        return [`${percentage}%`];
    }, [props.options.length]);

    // Handle opening and closing the bottom sheet
    useEffect(() => {
        if (props.visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.dismiss();
        }
    }, [props.visible]);

    // Safe way to update parent state when sheet is dismissed
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && props.visible) {
                props.setVisible(false);
            }
        },
        [props.visible, props.setVisible]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
        ),
        []
    );

    // Content container styles
    const styles = StyleSheet.create({
        contentContainer: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 12,
        },
        optionContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 4,
        },
    });

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
            <BottomSheetView style={styles.contentContainer}>
                {props.options.map((option, index) => {
                    // Split label if there's a highlight part
                    const renderLabel = () => {
                        if (option.labelHighlight && option.label.includes(option.labelHighlight)) {
                            const parts = option.label.split(option.labelHighlight);
                            return (
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <ThemedText type="default">{parts[0]}</ThemedText>
                                    <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                                        {option.labelHighlight}
                                    </ThemedText>
                                    {parts[1] && <ThemedText type="default">{parts[1]}</ThemedText>}
                                </View>
                            );
                        }
                        return <ThemedText type="default">{option.label}</ThemedText>;
                    };

                    return (
                        <TouchableOpacity
                            key={index}
                            style={styles.optionContainer}
                            onPress={() => {
                                bottomSheetModalRef.current?.dismiss();
                                // Only call the callback if it exists
                                option.callback && option.callback();
                            }}>
                            <Feather name={option.icon} size={24} color={ThemedColor.text} />
                            {renderLabel()}
                        </TouchableOpacity>
                    );
                })}
            </BottomSheetView>
        </BottomSheetModal>
    );
});

export default BottomMenuModal;
