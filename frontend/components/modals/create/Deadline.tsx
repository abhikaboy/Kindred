import { View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DateTimePicker from "@react-native-community/datetimepicker";
type Props = {
    goToStandard: () => void;
};

const Deadline = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Set Deadline
                </ThemedText>
            </View>
            <ThemedCalendar />
            <DateTimePicker
                style={{ width: "100%", height: 100 }}
                value={new Date()}
                testID="bruh"
                mode="time"
                is24Hour={true}
                display="spinner"
            />
            <PrimaryButton onPress={goToStandard} title="Set Deadline" />
        </View>
    );
};

export default Deadline;
