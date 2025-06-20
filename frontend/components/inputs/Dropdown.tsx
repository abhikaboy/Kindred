import { StyleSheet, Text, Touchable, View } from "react-native";
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
type Props = {
    options?: Option[];
    selected: Option;
    setSelected: Dispatch<SetStateAction<Option>>;
    onSpecial: () => void;
    width?: string;
};

const Dropdown = ({ options, selected, setSelected, onSpecial, width }: Props) => {
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
            borderBottomColor: expanded.value ? ThemedColor.disabled : ThemedColor.lightened,
        };
    });

    const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
    const AnimatedArrow = Animated.createAnimatedComponent(Entypo);
    return (
        <Animated.View
            style={{ borderRadius: 12, borderWidth: 1, borderColor: ThemedColor.tertiary, width: width || "80%" }}>
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
                        backgroundColor: ThemedColor.lightened,
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
                <Animated.View entering={reducedMotion ? null : FadeInUp} exiting={reducedMotion ? null : FadeOut}>
                    {options.map((item, index) => {
                        return (
                            <AnimatedTouchableOpacity
                                key={index}
                                onPress={() => {
                                    setSelected(item);
                                    if (item.special) onSpecial();
                                    expanded.value = false;
                                    setExpandedState(false);
                                }}
                                style={{
                                    backgroundColor: ThemedColor.lightened,
                                    padding: 8,
                                    paddingHorizontal: HORIZONTAL_PADDING,
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                }}>
                                <ThemedText type="lightBody">{item.label}</ThemedText>
                            </AnimatedTouchableOpacity>
                        );
                    })}
                </Animated.View>
            )}
        </Animated.View>
    );
};

export default Dropdown;

const styles = StyleSheet.create({});
