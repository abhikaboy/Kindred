import { StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";

import { Calendar } from "react-native-calendars";
import { useThemeColor } from "@/hooks/useThemeColor";
import { stringToLocalAwareDate } from "@/utils/timeUtils";

type Props = {
    dateReciever: (date: any) => void;
};

const ThemedCalendar = ({ dateReciever }: Props) => {
    const [selectedDates, setSelectedDates] = useState<any>([]);
    let ThemedColor = useThemeColor();

    const onDayPress = (day) => {
        console.log("selected day", day.dateString);
        if (selectedDates.includes(day.dateString)) {
            setSelectedDates(selectedDates.filter((date) => date !== day.dateString));
            console.log("dateReciever", null);
            dateReciever(null);
            return;
        }
        setSelectedDates([day.dateString]);
        dateReciever(stringToLocalAwareDate(day.dateString)); // use local midnight
        return;
        // setSelectedDates([...selectedDates, day.dateString]);
    };

    useEffect(() => {
        console.log("selected dates", selectedDates);
        console.log(
            selectedDates.map((date) => {
                return {
                    [date]: { selected: true },
                };
            })
        );
    }, [selectedDates]);

    // Get today's date in local time as YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const minDateLocal = `${yyyy}-${mm}-${dd}`;

    return (
        <View>
            <Calendar
                minDate={minDateLocal}
                theme={{
                    backgroundColor: ThemedColor.lightened,
                    calendarBackground: ThemedColor.lightened,
                    textSectionTitleColor: ThemedColor.text,
                    selectedDayBackgroundColor: ThemedColor.tertiary,
                    selectedDayTextColor: ThemedColor.primary,
                    todayTextColor: ThemedColor.primary,
                    dayTextColor: ThemedColor.text,
                    textDisabledColor: ThemedColor.disabled,
                    dotColor: ThemedColor.primary,
                    monthTextColor: ThemedColor.text,
                    textDayFontSize: 16,
                    agendaDayTextColor: ThemedColor.text,
                    agendaTodayColor: ThemedColor.primary,
                    arrowColor: ThemedColor.text,
                    textDayFontFamily: "OutfitLight",
                    textMonthFontFamily: "Outfit",
                    textMonthFontSize: 20,
                    textMonthFontWeight: "semibold",
                    textDayHeaderFontFamily: "Outfit",
                }}
                markingType="period"
                markedDates={selectedDates.reduce((acc, date) => {
                    return {
                        ...acc,
                        [date]: { selected: true, marked: true },
                    };
                }, {})}
                style={{
                    borderRadius: 10,
                }}
                onDayPress={onDayPress}
            />
        </View>
    );
};

export default ThemedCalendar;

const styles = StyleSheet.create({});
