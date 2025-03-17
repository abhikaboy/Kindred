import { StyleSheet, Text, Touchable, View } from "react-native";
import React, { Dispatch, SetStateAction, useEffect } from "react";
import { MultipleSelectList, SelectList } from "react-native-dropdown-select-list";
import ThemedColor from "@/constants/Colors";
import Entypo from "@expo/vector-icons/Entypo";
import Octicons from "@expo/vector-icons/Octicons";
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

type Props = {
    options?: Option[];
    selected: Option;
    setSelected: Dispatch<SetStateAction<Option>>;
    onSpecial: () => void;
};

const Dropdown = ({ options, selected, setSelected, onSpecial }: Props) => {
    const expanded = useSharedValue(false);
    const [expandedState, setExpandedState] = React.useState(false);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        expanded.value = expandedState;
    }, [expandedState]);

    useEffect(() => {
        if (options.length === 0) return;
        setSelected(options[0]);
    }, []);

    let mainBar = useAnimatedStyle(() => {
        return {
            borderBottomLeftRadius: expanded.value ? 0 : 20,
            borderBottomRightRadius: expanded.value ? 0 : 20,
            borderBottomWidth: expanded.value ? 1 : 0,
            borderBottomColor: expanded.value ? ThemedColor.disabled : ThemedColor.lightened,
        };
    });

    const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
    const AnimatedArrow = Animated.createAnimatedComponent(Entypo);
    return (
        <Animated.View>
            <AnimatedTouchableOpacity
                onPress={() => {
                    expanded.value = !expanded.value;
                    setExpandedState(!expandedState);
                }}
                style={[
                    mainBar,
                    {
                        borderRadius: 20,
                        padding: 16,
                        backgroundColor: ThemedColor.lightened,
                        paddingHorizontal: 24,
                        flexDirection: "row",
                        justifyContent: "space-between",
                    },
                ]}>
                <ThemedText type="lightBody">{selected.label}</ThemedText>
                {expandedState ? (
                    <AnimatedArrow name="chevron-down" size={16} color="white" entering={FadeIn} exiting={FadeOut} />
                ) : (
                    <AnimatedArrow name="chevron-up" size={16} color="white" entering={FadeIn} exiting={FadeOut} />
                )}
            </AnimatedTouchableOpacity>
            {expandedState && (
                <Animated.View entering={reducedMotion ? null : FadeInUp} exiting={reducedMotion ? null : FadeOutDown}>
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
                                    paddingHorizontal: 24,
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
