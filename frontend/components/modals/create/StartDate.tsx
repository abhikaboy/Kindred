import { View } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";

type Props = {
    goToStandard: () => void;
};

const StartDate = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const { startDate, setStartDate } = useTaskCreation();
    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Set Start Date {startDate ? new Date(startDate).toLocaleDateString() : "No Date Selected"}
                </ThemedText>
            </View>
            <ThemedCalendar dateReciever={setStartDate} />
            <PrimaryButton onPress={() => goToStandard()} title="Set Start Date" />
        </View>
    );
};

export default StartDate;
