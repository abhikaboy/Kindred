import { StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";

import { Calendar } from "react-native-calendars";
import ThemedColor from "@/constants/Colors";

type Props = {};

const ThemedCalendar = (props: Props) => {
    const [selectedDates, setSelectedDates] = useState<any>([]);

    const onDayPress = (day) => {
        console.log("selected day", day.dateString);
        if (selectedDates.includes(day.dateString)) {
            setSelectedDates(selectedDates.filter((date) => date !== day.dateString));
            return;
        }
        setSelectedDates([...selectedDates, day.dateString]);
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
                horizontal={true}
                theme={{
                    backgroundColor: ThemedColor.lightened,
                    calendarBackground: ThemedColor.lightened,
                    textSectionTitleColor: ThemedColor.text,
                    selectedDayBackgroundColor: ThemedColor.primary,
                    selectedDayTextColor: ThemedColor.text,
                    todayTextColor: ThemedColor.primary,
                    dayTextColor: ThemedColor.text,
                    textDisabledColor: ThemedColor.disabled,
                    dotColor: ThemedColor.primary,
                    monthTextColor: ThemedColor.text,
                    textDayFontSize: 16,
                    agendaDayTextColor: ThemedColor.text,
                    agendaTodayColor: ThemedColor.primary,
                    arrowColor: ThemedColor.text,
                    textDayFontFamily: "Outfit",
                    textMonthFontFamily: "Outfit",
                    textMonthFontSize: 20,
                    textMonthFontWeight: "bold",
                    textDayHeaderFontFamily: "Outfit",
                }}
                displayName="Calendar"
                firstDayOfWeek="monday"
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
