import { StyleSheet, View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Repeat, Stack, ArrowRight, Clock, CalendarCheck, CalendarPlus, Lightning } from "phosphor-react-native";
import DataCard from "./DataCard";
import { FlexInstanceInfo } from "@/api/types";

type Props = {
    recurDetails: {
        every?: number;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        months?: number[];
        behavior?: string;
        reminders?: string[];
    };
    frequency?: string;
    recurType?: string;
    lastDate?: string;
    nextDate?: string;
    flexInfo?: FlexInstanceInfo;
};

const RecurringInfoCard = ({ recurDetails, frequency, recurType, lastDate, nextDate, flexInfo }: Props) => {
    const ThemedColor = useThemeColor();

    const getPeriodLabel = (period: string) => {
        switch (period) {
            case "daily": return "day";
            case "weekly": return "week";
            case "monthly": return "month";
            default: return period;
        }
    };

    const renderFrequencyVisual = () => {
        if (frequency === "weekly" && recurDetails.daysOfWeek) {
            const days = ["S", "M", "T", "W", "T", "F", "S"];
            return (
                <View style={styles.weekContainer}>
                    {recurDetails.daysOfWeek.map((active, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dayCircle,
                                {
                                    backgroundColor: active === 1 ? ThemedColor.primary : "transparent",
                                    borderColor: active === 1 ? ThemedColor.primary : ThemedColor.border,
                                },
                            ]}
                        >
                            <ThemedText
                                type="caption"
                                style={{
                                    color: active === 1 ? "#FFFFFF" : ThemedColor.caption,
                                    fontWeight: active === 1 ? "bold" : "normal",
                                }}
                            >
                                {days[index]}
                            </ThemedText>
                        </View>
                    ))}
                </View>
            );
        }
        return null;
    };

    const getFrequencyText = () => {
        const everyVal = recurDetails.every || 1;
        const every = everyVal > 1 ? `Every ${everyVal} ` : "Every ";
        switch (frequency) {
            case "daily":
                return `${every}day`;
            case "weekly":
                return `${every}week`;
            case "monthly":
                return `${every}month`;
            case "yearly":
                return `${every}year`;
            default:
                return frequency || "Recurring";
        }
    };

    const getBehaviorText = () => {
        if (recurDetails.behavior === "BUILDUP") {
            return "Missed tasks pile up";
        }
        return "Due date rolls over";
    };

    const getTypeText = () => {
        return recurType === "OCCURRENCE" ? "Based on Start Date" : "Based on Deadline";
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <DataCard
            title="Recurring Schedule"
            icon={<Repeat size={20} color={ThemedColor.text} weight="regular" />}
        >
            <View style={styles.container}>
                {flexInfo ? (
                    <>
                        {/* Flex Header */}
                        <View style={styles.section}>
                            <View style={styles.iconRow}>
                                <Lightning size={18} color={ThemedColor.primary} weight="fill" />
                                <ThemedText type="defaultSemiBold">
                                    Flex: {flexInfo.target}x per {getPeriodLabel(flexInfo.period)}
                                </ThemedText>
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: ThemedColor.border }]} />

                        {/* Flex Progress */}
                        <View style={styles.section}>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                Progress this {getPeriodLabel(flexInfo.period)}
                            </ThemedText>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <View style={{
                                    flex: 1, height: 8, borderRadius: 4,
                                    backgroundColor: ThemedColor.border,
                                    overflow: "hidden",
                                }}>
                                    <View style={{
                                        width: `${(flexInfo.instanceNumber / flexInfo.target) * 100}%`,
                                        height: "100%",
                                        borderRadius: 4,
                                        backgroundColor: flexInfo.instanceNumber >= flexInfo.target
                                            ? "#4CAF50" : ThemedColor.primary,
                                    }} />
                                </View>
                                <ThemedText type="defaultSemiBold" style={{ fontSize: 14, minWidth: 36, textAlign: "right" }}>
                                    {flexInfo.instanceNumber}/{flexInfo.target}
                                </ThemedText>
                            </View>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Frequency Header */}
                        <View style={styles.section}>
                            <ThemedText type="defaultSemiBold">{getFrequencyText()}</ThemedText>
                            {renderFrequencyVisual()}
                        </View>

                        <View style={[styles.divider, { backgroundColor: ThemedColor.border }]} />

                        {/* Details Grid */}
                        <View style={styles.grid}>
                            <View style={styles.gridItem}>
                                <View style={styles.iconRow}>
                                    {recurDetails.behavior === "BUILDUP" ? (
                                        <Stack size={16} color={ThemedColor.caption} />
                                    ) : (
                                        <ArrowRight size={16} color={ThemedColor.caption} />
                                    )}
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        Behavior
                                    </ThemedText>
                                </View>
                                <ThemedText type="default" style={{ fontSize: 14 }}>{getBehaviorText()}</ThemedText>
                            </View>

                            <View style={styles.gridItem}>
                                <View style={styles.iconRow}>
                                    <Clock size={16} color={ThemedColor.caption} />
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        Schedule Type
                                    </ThemedText>
                                </View>
                                <ThemedText type="default" style={{ fontSize: 14 }}>{getTypeText()}</ThemedText>
                            </View>
                        </View>
                    </>
                )}

                {/* Timeline Section */}
                {(lastDate || nextDate) && (
                    <>
                        <View style={[styles.divider, { backgroundColor: ThemedColor.border }]} />
                        <View style={styles.grid}>
                            {lastDate && (
                                <View style={styles.gridItem}>
                                    <View style={styles.iconRow}>
                                        <CalendarCheck size={16} color={ThemedColor.caption} />
                                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                            Last Generated
                                        </ThemedText>
                                    </View>
                                    <ThemedText type="default" style={{ fontSize: 14 }}>
                                        {formatDate(lastDate)}
                                    </ThemedText>
                                </View>
                            )}
                            {nextDate && (
                                <View style={styles.gridItem}>
                                    <View style={styles.iconRow}>
                                        <CalendarPlus size={16} color={ThemedColor.caption} />
                                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                            Next Generation
                                        </ThemedText>
                                    </View>
                                    <ThemedText type="default" style={{ fontSize: 14 }}>
                                        {formatDate(nextDate)}
                                    </ThemedText>
                                </View>
                            )}
                        </View>
                    </>
                )}
            </View>
        </DataCard>
    );
};

export default RecurringInfoCard;

const styles = StyleSheet.create({
    container: {
        gap: 16,
        marginTop: 4,
    },
    section: {
        gap: 12,
    },
    weekContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 300,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    divider: {
        height: 1,
        opacity: 0.5,
    },
    grid: {
        flexDirection: "row",
        gap: 24,
    },
    gridItem: {
        flex: 1,
        gap: 6,
    },
    iconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
});
