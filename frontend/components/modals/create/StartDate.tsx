import { View } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalDate } from "@/utils/timeUtils";
import SuggestedTag from "@/components/inputs/SuggestedTag";

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
                    Set Start Date
                </ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <ThemedText type="defaultSemiBold">Start Date:</ThemedText>
                <ThemedText type="defaultSemiBold">{startDate ? startDate.toLocaleDateString() : ""}</ThemedText>
            </View>
            <View style={{ display: "flex", flexDirection: "row", gap: 4 }}>
                <SuggestedTag
                    tag="Today"
                    onPress={() => {
                        setStartDate(new Date());
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    tag="Tomorrow"
                    onPress={() => {
                        setStartDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
                        goToStandard();
                    }}
                />
                <SuggestedTag
                    tag="In a Week"
                    onPress={() => {
                        setStartDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
                        goToStandard();
                    }}
                />
            </View>
            <ThemedCalendar dateReciever={setStartDate} />
            <PrimaryButton onPress={() => goToStandard()} title="Set Start Date" />
        </View>
    );
};

export default StartDate;
