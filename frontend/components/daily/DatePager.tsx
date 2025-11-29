import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import PagerView from "react-native-pager-view";
import { ThemedText } from "@/components/ThemedText";
import Entry from "@/components/daily/Entry";
import { Feather } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { 
    addMonths,
    subMonths
} from "date-fns";
import { MonthView } from "@/components/ui/MonthView";

interface DatePagerProps {
    centerDate: Date;
    selectedDate: Date;
    onDateSelected: (date: Date) => void;
    onPageChange: (direction: "prev" | "next") => void;
    setCenterDate: (date: Date) => void;
}

const PAGE_SIZE = 6;

function getDateArray(startDate: Date, numDays: number) {
    return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

export const DatePager: React.FC<DatePagerProps> = ({ 
    centerDate, 
    selectedDate, 
    onDateSelected, 
    onPageChange,
    setCenterDate
}) => {
    const pagerRef = useRef<PagerView>(null);
    const [pageIndex, setPageIndex] = useState(1);
    const [isExpanded, setIsExpanded] = useState(false);
    const ThemedColor = useThemeColor();

    // Calculate date windows for PagerView
    const prevStart = new Date(centerDate);
    prevStart.setDate(centerDate.getDate() - PAGE_SIZE);
    const nextStart = new Date(centerDate);
    nextStart.setDate(centerDate.getDate() + PAGE_SIZE);

    const prevDates = getDateArray(prevStart, PAGE_SIZE);
    const currentDates = getDateArray(centerDate, PAGE_SIZE);
    const nextDates = getDateArray(nextStart, PAGE_SIZE);

    const onPageSelected = (e: any) => {
        const position = e.nativeEvent.position;
        if (position === 2) {
            onPageChange("next");
            setPageIndex(1);
        } else if (position === 0) {
            onPageChange("prev");
            setPageIndex(1);
        } else {
            setPageIndex(position);
        }
    };

    useEffect(() => {
        if (pagerRef.current && pageIndex !== 1) {
            pagerRef.current.setPageWithoutAnimation(1);
        }
    }, [centerDate]);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const handleMonthChange = (direction: "prev" | "next") => {
        if (direction === "next") {
            setCenterDate(addMonths(centerDate, 1));
        } else {
            setCenterDate(subMonths(centerDate, 1));
        }
    };

    const renderDatePage = (dates: Date[]) => (
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={{ gap: 12, flexDirection: "row" }}>
                {dates.map((date) => (
                    <Entry
                        day={date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                        date={date.getDate().toString()}
                        outline={
                            date.getMonth() === selectedDate.getMonth() &&
                            date.getUTCDate() === selectedDate.getUTCDate()
                        }
                        onPress={() => onDateSelected(date)}
                        key={date.toISOString()}
                    />
                ))}
            </View>
        </View>
    );

    return (
        <View style={[styles.container, isExpanded && styles.expandedContainer]}>
            {/* Header with Month Name and Toggle Arrow */}
            <View style={styles.header}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ThemedText type="subtitle">
                        {centerDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </ThemedText>
                    <TouchableOpacity onPress={toggleExpanded} style={styles.arrowButton}>
                        <Feather 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={20} 
                            color={ThemedColor.text} 
                        />
                    </TouchableOpacity>
                </View>
                
                {isExpanded && (
                    <View style={{ flexDirection: "row", gap: 16 }}>
                        <TouchableOpacity onPress={() => handleMonthChange("prev")}>
                            <Feather name="chevron-left" size={24} color={ThemedColor.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleMonthChange("next")}>
                            <Feather name="chevron-right" size={24} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {isExpanded ? (
                <MonthView
                    centerDate={centerDate}
                    selectedDate={selectedDate}
                    onDateSelected={(date) => {
                        onDateSelected(date);
                    }}
                />
            ) : (
                <PagerView
                    ref={pagerRef}
                    style={{ flex: 1 }}
                    initialPage={1}
                    onPageSelected={onPageSelected}
                    key={centerDate.toISOString()}>
                    <View key="prev" style={{ flex: 1 }}>
                        {renderDatePage(prevDates)}
                    </View>
                    <View key="current" style={{ flex: 1 }}>
                        {renderDatePage(currentDates)}
                    </View>
                    <View key="next" style={{ flex: 1 }}>
                        {renderDatePage(nextDates)}
                    </View>
                </PagerView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // Base height for the collapsed state (week view)
        minHeight: Dimensions.get("screen").height * 0.125,
    },
    expandedContainer: {
        // Allow container to grow in expanded state
        height: "auto",
    },
    header: {
        flexDirection: "row", 
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        marginBottom: 12,
    },
    arrowButton: {
        padding: 4,
    },
});

