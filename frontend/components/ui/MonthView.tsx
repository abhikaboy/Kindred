import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    isSameMonth,
    isSameDay,
} from "date-fns";

interface MonthViewProps {
    centerDate: Date;
    selectedDate: Date;
    onDateSelected: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({ 
    centerDate, 
    selectedDate, 
    onDateSelected 
}) => {
    const ThemedColor = useThemeColor();
    
    const renderGrid = () => {
        const monthStart = startOfMonth(centerDate);
        const monthEnd = endOfMonth(centerDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const dateFormat = "d";
        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, dateFormat);
                const cloneDay = day;
                
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);

                days.push(
                    <TouchableOpacity
                        key={day.toString()}
                        style={[
                            styles.monthDayCell,
                            isSelected && { backgroundColor: ThemedColor.primary, borderRadius: 8 },
                        ]}
                        onPress={() => onDateSelected(cloneDay)}
                    >
                        <ThemedText 
                            type={isSelected ? "defaultSemiBold" : "default"}
                            style={{ 
                                color: isSelected 
                                    ? ThemedColor.background 
                                    : isCurrentMonth 
                                        ? ThemedColor.text 
                                        : ThemedColor.caption,
                                textAlign: "center"
                            }}
                        >
                            {formattedDate}
                        </ThemedText>
                    </TouchableOpacity>
                );
                day = new Date(day.setDate(day.getDate() + 1));
            }
            rows.push(
                <View key={day.toString()} style={styles.monthRow}>
                    {days}
                </View>
            );
            days = [];
        }
        return <View style={styles.monthGrid}>{rows}</View>;
    };

    return (
        <View style={styles.monthContainer}>
            {/* Weekday Headers */}
            <View style={styles.weekHeaderRow}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <ThemedText key={day} type="caption" style={styles.weekHeaderCell}>
                        {day}
                    </ThemedText>
                ))}
            </View>
            {renderGrid()}
        </View>
    );
};

const styles = StyleSheet.create({
    monthContainer: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    weekHeaderRow: {
        flexDirection: "row",
        marginBottom: 8,
    },
    weekHeaderCell: {
        flex: 1,
        textAlign: "center",
        opacity: 0.6,
    },
    monthGrid: {
        gap: 8,
    },
    monthRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    monthDayCell: {
        flex: 1,
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});

