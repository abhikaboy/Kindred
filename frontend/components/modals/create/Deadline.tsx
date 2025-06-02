import { View } from "react-native";
import React, { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedCalendar from "@/components/inputs/ThemedCalendar";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatLocalDate, formatLocalTime } from "@/utils/timeUtils";

type Props = {
    goToStandard: () => void;
};

const Deadline = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();

    const [time, setTime] = useState<Date | null>(null);
    const [date, setDate] = useState<Date | null>(null);

    const { deadline, setDeadline } = useTaskCreation();

    const combineDateAndTime = () => {
        if (date && time) {
            setDeadline(new Date(date.toISOString().split("T")[0] + "T" + time.toISOString().split("T")[1]));
            return;
        }
        if (date) {
            setDeadline(new Date(date.toISOString()));
            return;
        }
        if (time) {
            setDeadline(new Date(time.toISOString()));
            return;
        }
        setDeadline(null);
    };

    useEffect(() => {
        combineDateAndTime();
    }, [date, time]);

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
            <ThemedCalendar dateReciever={setDate} />
            <DateTimePicker
                style={{ width: "100%", height: 100 }}
                value={time || new Date()}
                onChange={(event, selectedDate) => {
                    if (selectedDate) {
                        setTime(selectedDate);
                    }
                }}
                testID="bruh"
                mode="time"
                is24Hour={true}
                display="spinner"
            />
            <PrimaryButton
                onPress={goToStandard}
                title={
                    deadline
                        ? "Set Deadline: " + formatLocalDate(deadline) + " at " + formatLocalTime(deadline)
                        : "No deadline selected"
                }
            />
        </View>
    );
};

export default Deadline;
