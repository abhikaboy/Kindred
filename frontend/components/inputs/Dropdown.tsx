import { StyleSheet, Text, Touchable, View, DimensionValue } from "react-native";
import React, { Dispatch, SetStateAction, useEffect } from "react";
import { MultipleSelectList, SelectList } from "react-native-dropdown-select-list";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entypo from "@expo/vector-icons/Entypo";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import Animated, {
    useReducedMotion,
    FadeIn,
    FadeInUp,
    FadeOut,
    FadeOutDown,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import * as Haptics from "expo-haptics";

type Option = {
    label: string;
    id: string;
    special?: boolean;
};

type Props = {
    options?: Option[];
    footerOptions?: Option[]; // New optional footer options
    selected: Option;
    setSelected: Dispatch<SetStateAction<Option>>;
    onSpecial: () => void;
    width?: DimensionValue;
    ghost?: boolean;
};

const Dropdown = ({ options, footerOptions, selected, setSelected, onSpecial, width, ghost }: Props) => {
    const expanded = useSharedValue(false);
    const [expandedState, setExpandedState] = React.useState(false);
    const reducedMotion = useReducedMotion();
    let ThemedColor = useThemeColor();

    useEffect(() => {
        expanded.value = expandedState;
    }, [expandedState]);

    useEffect(() => {
        if (options.length === 0) return;
        setSelected(selected);
    }, []);

    let mainBar = useAnimatedStyle(() => {
        return {
            borderBottomLeftRadius: expanded.value ? 0 : 12,
            borderBottomRightRadius: expanded.value ? 0 : 12,
            borderBottomWidth: expanded.value ? 1 : 0,
            borderBottomColor: expanded.value ? ThemedColor.disabled : ThemedColor.tertiary,
        };
    });

    const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
    const AnimatedArrow = Animated.createAnimatedComponent(Entypo);
    return (
        <Animated.View
            style={{
                borderRadius: 12,
                borderWidth: ghost ? 0 : 1,
                borderColor: ghost ? "transparent" : ThemedColor.tertiary,
                width: width || "50%",
                shadowColor: ThemedColor.text,
            }}>
            <AnimatedTouchableOpacity
                onPress={() => {
                    expanded.value = !expanded.value;
                    setExpandedState(!expandedState);
                }}
                style={[
                    mainBar,
                    {
                        borderRadius: 12,
                        padding: 16,
                        paddingLeft: ghost ? 0 : 16,
                        backgroundColor: ThemedColor.background,
                        paddingHorizontal: HORIZONTAL_PADDING,
                        flexDirection: "row",
                        justifyContent: "space-between",
                    },
                ]}>
                <ThemedText type="lightBody">{selected.label || "Select a Category"}</ThemedText>
                {expandedState ? (
                    <AnimatedArrow
                        name="chevron-down"
                        size={16}
                        color={ThemedColor.text}
                        entering={FadeIn}
                        exiting={FadeOut}
                    />
                ) : (
                    <AnimatedArrow
                        name="chevron-up"
                        size={16}
                        color={ThemedColor.text}
                        entering={FadeIn}
                        exiting={FadeOut}
                    />
                )}
            </AnimatedTouchableOpacity>
            {expandedState && (
                <Animated.View
                    entering={reducedMotion ? null : FadeInUp}
                    exiting={reducedMotion ? null : FadeOut}
                    style={{
                        borderWidth: 0.5,
                        borderColor: ThemedColor.tertiary,
                        borderTopWidth: 0,
                        borderBottomLeftRadius: 12,
                        backgroundColor: ThemedColor.background,
                        borderBottomRightRadius: 12,
                    }}>
                    {/* Main options */}
                    {options.map((item, index) => {
                        return (
                            <AnimatedTouchableOpacity
                                key={`main-${index}`}
                                onPress={() => {
                                    setSelected(item);
                                    if (item.special) onSpecial();
                                    expanded.value = false;
                                    setExpandedState(false);
                                    Haptics.selectionAsync();
                                }}
                                style={{
                                    backgroundColor: ThemedColor.background,
                                    padding: 8,
                                    paddingHorizontal: HORIZONTAL_PADDING,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    borderRadius: 12,
                                }}>
                                <ThemedText type="lightBody">{item.label}</ThemedText>
                            </AnimatedTouchableOpacity>
                        );
                    })}
                    
                    <View style={{
                        borderColor: ThemedColor.tertiary,
                        borderTopWidth: 1,
                        borderBottomLeftRadius: 12,
                        backgroundColor: ThemedColor.background,
                        borderBottomRightRadius: 12,
                        paddingVertical: 4,
                    }}>

                    {footerOptions && footerOptions.map((item, index) => {
                        return (
                            <AnimatedTouchableOpacity
                            key={`footer-${index}`}
                            onPress={() => {
                                setSelected(item);
                                if (item.special) onSpecial();
                                expanded.value = false;
                                setExpandedState(false);
                                Haptics.selectionAsync();
                            }}
                            style={{
                                backgroundColor: ThemedColor.background,
                                padding: 8,
                                paddingHorizontal: HORIZONTAL_PADDING,
                                flexDirection: "row",
                                justifyContent: "space-between",
                                borderRadius: 12,
                                }}>
                                <ThemedText type="lightBody">{item.label}</ThemedText>
                            </AnimatedTouchableOpacity>
                        );
                    })}
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};

export default Dropdown;

const styles = StyleSheet.create({});
