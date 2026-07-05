import React, { useMemo, useState } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import CachedImage from "@/components/CachedImage";
import ActivityPoint from "@/components/profile/ActivityPoint";
import CompletedTasksBottomSheetModal from "@/components/modals/CompletedTasksBottomSheetModal";
import { activityAPI, calculateActivityLevel } from "@/api/activity";
import { getUserPosts } from "@/api/post";
import { postCover } from "@/utils/postMedia";
import { hapticLight } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { useFirstTouchHint } from "@/hooks/useFirstTouchHint";
import HintBubble from "@/components/ui/HintBubble";

const GAP = 4;
const CONTAINER_PADDING = 20 * 2; // matches profile contentContainer paddingHorizontal
const CELL = Math.floor((Dimensions.get("window").width - CONTAINER_PADDING - GAP * 6) / 7);
const WEEKS = 4;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Local-date key so posts and activity land on the same calendar cell.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

interface MemoriesCalendarProps {
    userId?: string;
}

const MemoriesCalendar = ({ userId }: MemoriesCalendarProps) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { user } = useAuth();
    // The completed-tasks sheet only knows the viewer's own tasks — day
    // drill-down is self-profile only.
    const isSelf = !!userId && user?._id === userId;
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    // First-touch (own profile only — other profiles aren't tappable day-by-day)
    const { ready: memoriesHintReady, done: memoriesHintDone } = useFirstTouchHint("memories_days");

    // 4 rows of weeks ending on the Saturday of the current week.
    const cells = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setDate(end.getDate() + (6 - end.getDay()));
        return Array.from({ length: WEEKS * 7 }, (_, i) => {
            const date = new Date(end);
            date.setDate(end.getDate() - (WEEKS * 7 - 1 - i));
            return {
                date,
                isToday: date.getTime() === today.getTime(),
                isFuture: date.getTime() > today.getTime(),
            };
        });
    }, []);

    // Newest post cover per day. 50 is the server-side max for `limit` —
    // Huma 422s anything higher before the handler runs.
    // ponytail: last 50 posts covers the window; paginate by date if that ever falls short
    const { data: coversByDay } = useQuery({
        queryKey: ["memories-posts", userId],
        enabled: !!userId,
        staleTime: 60 * 1000,
        queryFn: () => getUserPosts(userId!, 50, 0),
        select: (res) => {
            const map: Record<string, { url: string; postId: string }> = {};
            const sorted = [...res.posts].sort(
                (a: any, b: any) =>
                    new Date(b.metadata?.createdAt || 0).getTime() - new Date(a.metadata?.createdAt || 0).getTime()
            );
            for (const post of sorted as any[]) {
                if (!post.metadata?.createdAt) continue;
                const key = dayKey(new Date(post.metadata.createdAt));
                if (map[key]) continue;
                const cover = postCover(post);
                if (cover) map[key] = { url: cover.url, postId: post._id };
            }
            return map;
        },
    });

    // Activity level per day across the (at most two) months the grid spans.
    const months = useMemo(() => {
        const seen = new Map<string, [number, number]>();
        cells.forEach(({ date }) => {
            seen.set(`${date.getFullYear()}-${date.getMonth() + 1}`, [date.getFullYear(), date.getMonth() + 1]);
        });
        return [...seen.values()];
    }, [cells]);

    const { data: levelsByDay } = useQuery({
        queryKey: ["memories-activity", userId, months.map((m) => m.join("-")).join(",")],
        enabled: !!userId,
        staleTime: 60 * 1000,
        queryFn: async () => {
            const docs = await Promise.all(
                months.map(([year, month]) =>
                    activityAPI.getActivityByUserAndPeriod(userId!, year, month).catch(() => null)
                )
            );
            const map: Record<string, number> = {};
            docs.forEach((doc) => {
                doc?.days?.forEach((d) => {
                    map[`${doc.year}-${doc.month - 1}-${d.day}`] = calculateActivityLevel(d.count);
                });
            });
            return map;
        },
    });

    if (!userId) return null;

    const weeks = Array.from({ length: WEEKS }, (_, w) => cells.slice(w * 7, w * 7 + 7));

    return (
        <>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.header}
                    onPress={() => router.push(`/activity/${userId}`)}
                    activeOpacity={0.7}>
                    <ThemedText type="subtitle">Memories</ThemedText>
                    <CaretRightIcon size={20} color={ThemedColor.text} />
                </TouchableOpacity>

                {isSelf && memoriesHintReady && (
                    <HintBubble
                        text="Tap a day to revisit what you did"
                        onDone={memoriesHintDone}
                        autoDismissMs={7000}
                    />
                )}

                <View style={styles.weekRow}>
                    {WEEKDAYS.map((day) => (
                        <ThemedText
                            key={day}
                            type="caption"
                            style={[styles.weekdayLabel, { color: ThemedColor.caption }]}>
                            {day}
                        </ThemedText>
                    ))}
                </View>

                {weeks.map((week, weekIndex) => (
                    <View key={`week-${weekIndex}`} style={styles.weekRow}>
                        {week.map(({ date, isToday, isFuture }) => {
                            const cover = coversByDay?.[dayKey(date)];
                            if (cover && !isFuture) {
                                return (
                                    <TouchableOpacity
                                        key={dayKey(date)}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            memoriesHintDone();
                                            hapticLight();
                                            router.push(`/(logged-in)/posting/${cover.postId}`);
                                        }}
                                        style={[
                                            styles.memoryCell,
                                            isToday && { borderWidth: 2, borderColor: ThemedColor.primary },
                                        ]}>
                                        <CachedImage
                                            source={{ uri: cover.url }}
                                            style={styles.memoryImage}
                                            variant="thumbnail"
                                            cachePolicy="disk"
                                            transition={100}
                                        />
                                        <View style={styles.dayChip}>
                                            <ThemedText type="caption" style={styles.dayChipText}>
                                                {date.getDate()}
                                            </ThemedText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }
                            return (
                                <ActivityPoint
                                    key={dayKey(date)}
                                    level={levelsByDay?.[dayKey(date)] ?? 0}
                                    isToday={isToday}
                                    isFuture={isFuture}
                                    size={CELL}
                                    label={String(date.getDate())}
                                    onPress={() => {
                                        if (isFuture || !isSelf) return;
                                        memoriesHintDone();
                                        hapticLight();
                                        setSelectedDate(date);
                                        setModalVisible(true);
                                    }}
                                />
                            );
                        })}
                    </View>
                ))}
            </View>

            <CompletedTasksBottomSheetModal visible={modalVisible} setVisible={setModalVisible} date={selectedDate} />
        </>
    );
};

const styles = StyleSheet.create({
    section: {
        gap: 8,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    weekRow: {
        flexDirection: "row",
        gap: GAP,
        marginBottom: GAP,
    },
    weekdayLabel: {
        width: CELL,
        textAlign: "center",
        fontSize: 11,
    },
    memoryCell: {
        width: CELL,
        height: CELL,
        borderRadius: 6,
        overflow: "hidden",
    },
    memoryImage: {
        width: "100%",
        height: "100%",
    },
    dayChip: {
        position: "absolute",
        top: 3,
        left: 3,
        paddingHorizontal: 4,
        borderRadius: 4,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    dayChipText: {
        color: "#ffffff",
        fontSize: 10,
    },
});

export default React.memo(MemoriesCalendar);
