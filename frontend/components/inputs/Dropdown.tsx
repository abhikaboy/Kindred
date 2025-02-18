import { StyleSheet, Text, Touchable, View } from "react-native";
import React, { useEffect } from "react";
import { MultipleSelectList, SelectList } from "react-native-dropdown-select-list";
import { Colors } from "@/constants/Colors";
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
const data = [
    { label: "+ New Category" },
    { label: "Option 1" },
    { label: "Option 2" },
    { label: "Option 3" },
    { label: "Option 4" },
];

type Props = {};

const Dropdown = (props: Props) => {
    const [selected, setSelected] = React.useState(data[0]);
    const expanded = useSharedValue(false);
    const [expandedState, setExpandedState] = React.useState(false);
    const router = useRouter();
    const reducedMotion = useReducedMotion();
    console.log(reducedMotion);

    useEffect(() => {
        expanded.value = expandedState;
    }, [expandedState]);

    let mainBar = useAnimatedStyle(() => {
        return {
            borderBottomLeftRadius: expanded.value ? 0 : 20,
            borderBottomRightRadius: expanded.value ? 0 : 20,
            borderBottomWidth: expanded.value ? 1 : 0,
            borderBottomColor: expanded.value ? Colors.dark.disabled : Colors.dark.lightened,
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
                        backgroundColor: Colors.dark.lightened,
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
                    {data.map((item, index) => {
                        return (
                            <AnimatedTouchableOpacity
                                key={index}
                                onPress={() => {
                                    setSelected(item);
                                    expanded.value = false;
                                    setExpandedState(false);
                                }}
                                style={{
                                    backgroundColor: Colors.dark.lightened,
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
