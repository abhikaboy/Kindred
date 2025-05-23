import { StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";

import { Calendar } from "react-native-calendars";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    dateReciever: (date: any) => void;
};

const ThemedCalendar = (props: Props) => {
    const [selectedDates, setSelectedDates] = useState<any>([]);
    let ThemedColor = useThemeColor();

    const onDayPress = (day) => {
        console.log("selected day", day.dateString);
        if (selectedDates.includes(day.dateString)) {
            setSelectedDates(selectedDates.filter((date) => date !== day.dateString));
            return;
        }
        if (selectedDates.length == 1) {
            setSelectedDates([day.dateString]);
            return;
        }
        setSelectedDates([...selectedDates, day.dateString]);
        props.dateReciever(day.dateString);
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

    return (
        <View>
            <Calendar
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
