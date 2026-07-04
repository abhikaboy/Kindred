# Week-First Planner Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `daily.tsx` as a week-first planner: Week view (strip + agenda) default, Month density grid, day timeline demoted to drill-down, and drag-to-schedule from a persistent Unscheduled tray.

**Architecture:** One route, two view modes (`week`/`month`) plus an agenda/timeline toggle inside week mode. New presentational components (`PlannerHeader`, `WeekStrip`, `MonthGrid`, `UnscheduledTray`) all feed off existing `useTasks`/`useDailyTasks` data plus one new pure counting helper. Drag-to-schedule uses a Pan gesture per tray chip, window-space drop rects registered by day cells (all in non-scrolling containers, so no scroll correction needed), a generic `rectAtPoint` added to `utils/dragHitTest.ts`, and the existing `updateTaskDeadlineAPI`.

**Tech Stack:** React Native + Expo, react-native-gesture-handler + reanimated (already installed), TanStack-free (contexts), jest.

Spec: `frontend/docs/superpowers/specs/2026-07-04-planner-week-first-redesign-design.md`

## Global Constraints

- Reuse existing components: `SegmentedControl`, `TaskListView`, `CalendarView`, `ScheduleTaskSheet`, `SwipableTaskCard` — do not fork them.
- Theme via `useThemeColor()` tokens and `ThemedText` semantic types only; no hardcoded colors/fonts. `useThemeColor` is a real hook — top-level of components only, pass the object into style factories.
- Icons: `phosphor-react-native` (not Ionicons) for anything new.
- No backend changes. Scheduling uses `updateTaskDeadlineAPI(categoryId, taskId, deadline)` from `api/task.ts`.
- Weeks are Monday-first. Day keys are local-time `YYYY-MM-DD`.
- Run tools with `bun` (never npx). Verification bar: `bun tsc --noEmit` (ignore the pre-existing DatePager errors) and `bun run test` (pre-existing failures: dragHitTest legacy case, AboutScreen, UserInfoRingsClosedNotification, TaskCardPostButton — do not add new failures).
- All new components live in `frontend/components/daily/`. Working dir for all commands below: `frontend/`.

---

### Task 1: Day-count helper + hook (`useTaskCountsByDay`)

**Files:**
- Create: `hooks/useTaskCountsByDay.ts`
- Test: `__tests__/taskCountsByDay.test.ts`

**Interfaces:**
- Consumes: `useTasks().allTasks` (tasks with optional `deadline`, `startDate` ISO strings, `categoryID`, `categoryName`), `getCategoryDuotoneColors(categoryID, categoryName, scheme)` from `utils/categoryColors`.
- Produces:
  - `dayKey(d: Date): string` — local `YYYY-MM-DD`.
  - `fromDayKey(key: string): Date` — local midnight.
  - `countTasksByDay(tasks: any[], start: Date, end: Date): Record<string, { count: number; categoryRefs: { categoryID?: string; categoryName?: string }[] }>` — pure, exported for tests. A task lands on the day of its `startDate` (if any) and the day of its `deadline` (if any); same task on the same day counts once. `categoryRefs` holds up to 3 unique categories.
  - `useTaskCountsByDay(start: Date, end: Date)` — memoized wrapper over `countTasksByDay(allTasks, ...)`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/taskCountsByDay.test.ts
import { countTasksByDay, dayKey, fromDayKey } from "@/hooks/useTaskCountsByDay";

const d = (s: string) => new Date(s);

describe("dayKey/fromDayKey", () => {
    it("round-trips a local date", () => {
        const date = new Date(2026, 6, 4, 15, 30); // Jul 4 2026, 3:30pm local
        expect(dayKey(date)).toBe("2026-07-04");
        expect(fromDayKey("2026-07-04").getTime()).toBe(new Date(2026, 6, 4).getTime());
    });
});

describe("countTasksByDay", () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 31);

    it("buckets deadline and startDate days, deduping same task on one day", () => {
        const tasks = [
            { id: "a", categoryID: "c1", categoryName: "School", deadline: d("2026-07-04T14:00:00").toISOString() },
            { id: "b", categoryID: "c2", categoryName: "Gym", startDate: d("2026-07-04T08:00:00").toISOString() },
            // same day start+deadline: counts once
            { id: "c", categoryID: "c1", categoryName: "School",
              startDate: d("2026-07-05T09:00:00").toISOString(), deadline: d("2026-07-05T17:00:00").toISOString() },
        ];
        const counts = countTasksByDay(tasks, start, end);
        expect(counts["2026-07-04"].count).toBe(2);
        expect(counts["2026-07-05"].count).toBe(1);
        expect(counts["2026-07-06"]).toBeUndefined();
    });

    it("ignores days outside the range and tasks with no dates", () => {
        const tasks = [
            { id: "a", deadline: d("2026-08-01T00:00:00").toISOString() },
            { id: "b" },
        ];
        expect(countTasksByDay(tasks, start, end)).toEqual({});
    });

    it("collects up to 3 unique category refs", () => {
        const tasks = [1, 2, 3, 4, 5].map((n) => ({
            id: String(n), categoryID: `c${n}`, categoryName: `Cat${n}`,
            deadline: d("2026-07-10T12:00:00").toISOString(),
        }));
        const day = countTasksByDay(tasks, start, end)["2026-07-10"];
        expect(day.count).toBe(5);
        expect(day.categoryRefs).toHaveLength(3);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- taskCountsByDay`
Expected: FAIL — cannot resolve `@/hooks/useTaskCountsByDay`.

- [ ] **Step 3: Write the implementation**

```ts
// hooks/useTaskCountsByDay.ts
import { useMemo } from "react";
import { useTasks } from "@/contexts/tasksContext";

export type DayDensity = {
    count: number;
    categoryRefs: { categoryID?: string; categoryName?: string }[];
};

export const dayKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromDayKey = (key: string): Date => {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day);
};

export function countTasksByDay(tasks: any[], start: Date, end: Date): Record<string, DayDensity> {
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
    const out: Record<string, DayDensity> = {};

    for (const task of tasks) {
        const days = new Set<string>();
        for (const field of ["startDate", "deadline"] as const) {
            if (!task[field]) continue;
            const date = new Date(task[field]);
            if (date.getTime() < startMs || date.getTime() > endMs) continue;
            days.add(dayKey(date));
        }
        for (const key of days) {
            const bucket = (out[key] ??= { count: 0, categoryRefs: [] });
            bucket.count += 1;
            const ref = { categoryID: task.categoryID, categoryName: task.categoryName };
            if (
                bucket.categoryRefs.length < 3 &&
                !bucket.categoryRefs.some((r) => r.categoryID === ref.categoryID)
            ) {
                bucket.categoryRefs.push(ref);
            }
        }
    }
    return out;
}

export function useTaskCountsByDay(start: Date, end: Date) {
    const { allTasks } = useTasks();
    return useMemo(
        () => countTasksByDay(allTasks, start, end),
        [allTasks, start.getTime(), end.getTime()]
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- taskCountsByDay`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(planner): day-bucketed task counts hook" -- hooks/useTaskCountsByDay.ts __tests__/taskCountsByDay.test.ts
```

---

### Task 2: Generic `rectAtPoint` in dragHitTest

**Files:**
- Modify: `utils/dragHitTest.ts` (append; do not change `categoryAtPoint`)
- Test: `__tests__/dragHitTest.test.ts` (append a new `describe`; one legacy test in this file already fails on main — leave it alone)

**Interfaces:**
- Produces: `export type DropRect = { key: string; x: number; y: number; width: number; height: number }` and `export function rectAtPoint(rects: DropRect[], x: number, y: number): string | null` — strict containment only, no slack (day cells tile edge-to-edge; the category slack heuristic doesn't apply).

- [ ] **Step 1: Write the failing test** (append to `__tests__/dragHitTest.test.ts`)

```ts
import { rectAtPoint, DropRect } from "@/utils/dragHitTest";

describe("rectAtPoint", () => {
    const rects: DropRect[] = [
        { key: "2026-07-01", x: 0, y: 100, width: 50, height: 50 },
        { key: "2026-07-02", x: 50, y: 100, width: 50, height: 50 },
    ];
    it("returns the containing rect's key", () => {
        expect(rectAtPoint(rects, 60, 120)).toBe("2026-07-02");
    });
    it("returns null outside all rects — no slack", () => {
        expect(rectAtPoint(rects, 60, 200)).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- dragHitTest`
Expected: new `rectAtPoint` tests FAIL (export missing); the one legacy `categoryAtPoint` failure is pre-existing — ignore it.

- [ ] **Step 3: Implement** (append to `utils/dragHitTest.ts`)

```ts
export type DropRect = { key: string; x: number; y: number; width: number; height: number };

/** Strict-containment hit test for tiled drop targets (day cells). */
export function rectAtPoint(rects: DropRect[], x: number, y: number): string | null {
    for (const r of rects) {
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return r.key;
    }
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- dragHitTest`
Expected: both new tests PASS; failure count in this file unchanged from main (1 legacy).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(planner): generic rectAtPoint hit test" -- utils/dragHitTest.ts __tests__/dragHitTest.test.ts
```

---

### Task 3: PlannerHeader

**Files:**
- Create: `components/daily/PlannerHeader.tsx`

**Interfaces:**
- Consumes: `SegmentedControl` (`options: string[]; selectedOption: string; onOptionPress(o: string); size?: "small"`), `ThemedText`, `useThemeColor`, `CaretLeft/CaretRight` from phosphor.
- Produces: `PlannerHeader({ anchorDate, mode, onStep, onModeChange }: { anchorDate: Date; mode: "week" | "month"; onStep: (delta: 1 | -1) => void; onModeChange: (mode: "week" | "month") => void })` — label is `anchorDate`'s "July 2026"; chevrons call `onStep` (parent decides week vs month stepping).

- [ ] **Step 1: Implement**

```tsx
// components/daily/PlannerHeader.tsx
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    anchorDate: Date;
    mode: "week" | "month";
    onStep: (delta: 1 | -1) => void;
    onModeChange: (mode: "week" | "month") => void;
};

const PlannerHeader = ({ anchorDate, mode, onStep, onModeChange }: Props) => {
    const ThemedColor = useThemeColor();
    const label = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    return (
        <View style={styles.row}>
            <View style={styles.stepper}>
                <TouchableOpacity onPress={() => onStep(-1)} hitSlop={8}>
                    <CaretLeft size={18} color={ThemedColor.primary} weight="bold" />
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesSubheading">{label}</ThemedText>
                <TouchableOpacity onPress={() => onStep(1)} hitSlop={8}>
                    <CaretRight size={18} color={ThemedColor.primary} weight="bold" />
                </TouchableOpacity>
            </View>
            <View style={styles.segment}>
                <SegmentedControl
                    options={["Week", "Month"]}
                    selectedOption={mode === "week" ? "Week" : "Month"}
                    onOptionPress={(o) => onModeChange(o === "Week" ? "week" : "month")}
                    size="small"
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 8,
        gap: 12,
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    segment: { width: 150 },
});

export default PlannerHeader;
```

- [ ] **Step 2: Verify it compiles**

Run: `bun tsc --noEmit 2>&1 | grep PlannerHeader`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(planner): header with month label and week/month toggle" -- components/daily/PlannerHeader.tsx
```

---

### Task 4: WeekStrip + shared DayDots

**Files:**
- Create: `components/daily/WeekStrip.tsx`

**Interfaces:**
- Consumes: `DayDensity`, `dayKey` (Task 1), `getCategoryDuotoneColors(categoryID, categoryName, scheme)` from `utils/categoryColors` (use `.dark` as the dot color; `scheme` from `useColorScheme() ?? "light"`).
- Produces:
  - `WeekStrip({ weekStart, selectedDate, onSelectDate, density, registerDropRect, hoverKey })` with `registerDropRect: (key: string, rect: { x: number; y: number; width: number; height: number } | null) => void` and `hoverKey: string | null` (drop-target highlight while a chip drag is over it).
  - Also exports `DayDots({ density }: { density?: DayDensity })` for reuse by MonthGrid (Task 5).
  - Exports `mondayOf(d: Date): Date`.

- [ ] **Step 1: Implement**

```tsx
// components/daily/WeekStrip.tsx
import React, { useRef } from "react";
import { View, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/hooks/useTaskCountsByDay";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";

export const mondayOf = (d: Date): Date => {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (out.getDay() + 6) % 7; // Mon=0
    out.setDate(out.getDate() - dow);
    return out;
};

export const DayDots = ({ density }: { density?: DayDensity }) => {
    const scheme = useColorScheme() ?? "light";
    if (!density) return <View style={dotStyles.row} />;
    return (
        <View style={dotStyles.row}>
            {density.categoryRefs.map((ref, i) => (
                <View
                    key={i}
                    style={[
                        dotStyles.dot,
                        { backgroundColor: getCategoryDuotoneColors(ref.categoryID, ref.categoryName, scheme).dark },
                    ]}
                />
            ))}
        </View>
    );
};

const dotStyles = StyleSheet.create({
    row: { flexDirection: "row", gap: 3, minHeight: 6, justifyContent: "center" },
    dot: { width: 5, height: 5, borderRadius: 3 },
});

type Props = {
    weekStart: Date;
    selectedDate: Date;
    onSelectDate: (d: Date) => void;
    density: Record<string, DayDensity>;
    registerDropRect: (key: string, rect: { x: number; y: number; width: number; height: number } | null) => void;
    hoverKey: string | null;
};

const WeekStrip = ({ weekStart, selectedDate, onSelectDate, density, registerDropRect, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const todayKey = dayKey(new Date());
    const selectedKey = dayKey(selectedDate);
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    return (
        <View style={styles.row}>
            {days.map((d) => {
                const key = dayKey(d);
                const selected = key === selectedKey;
                const isToday = key === todayKey;
                const hovered = key === hoverKey;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => onSelectDate(d)}
                        ref={(node) => {
                            if (!node) registerDropRect(key, null);
                        }}
                        onLayout={(e) => {
                            e.currentTarget.measureInWindow((x, y, width, height) =>
                                registerDropRect(key, { x, y, width, height })
                            );
                        }}
                        style={[
                            styles.day,
                            selected && { backgroundColor: ThemedColor.primary },
                            hovered && {
                                borderWidth: 1.5,
                                borderColor: ThemedColor.primary,
                                borderStyle: "dashed",
                                backgroundColor: ThemedColor.lightened,
                            },
                        ]}
                    >
                        <ThemedText type="caption" style={selected && { color: ThemedColor.buttonText }}>
                            {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                        </ThemedText>
                        <ThemedText
                            type="defaultSemiBold"
                            style={[isToday && !selected && { color: ThemedColor.primary }, selected && { color: ThemedColor.buttonText }]}
                        >
                            {d.getDate()}
                        </ThemedText>
                        <DayDots density={density[key]} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 6,
    },
    day: {
        alignItems: "center",
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 12,
        minWidth: 42,
    },
});

export default WeekStrip;
```

- [ ] **Step 2: Verify it compiles**

Run: `bun tsc --noEmit 2>&1 | grep WeekStrip`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(planner): week strip with density dots and drop targets" -- components/daily/WeekStrip.tsx
```

---

### Task 5: MonthGrid

**Files:**
- Create: `components/daily/MonthGrid.tsx`

**Interfaces:**
- Consumes: `DayDots`, `mondayOf` (Task 4), `dayKey`/`DayDensity` (Task 1).
- Produces: `MonthGrid({ monthAnchor, density, onSelectDay, registerDropRect, hoverKey })` — `monthAnchor: Date` (any day in the month), `onSelectDay(d: Date)` (parent flips to week mode). Grid: Monday-first, 6 rows, out-of-month cells dimmed, today outlined, `+N` overflow when `count > 3`.

- [ ] **Step 1: Implement**

```tsx
// components/daily/MonthGrid.tsx
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/hooks/useTaskCountsByDay";
import { DayDots, mondayOf } from "./WeekStrip";

type Props = {
    monthAnchor: Date;
    density: Record<string, DayDensity>;
    onSelectDay: (d: Date) => void;
    registerDropRect: (key: string, rect: { x: number; y: number; width: number; height: number } | null) => void;
    hoverKey: string | null;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const MonthGrid = ({ monthAnchor, density, onSelectDay, registerDropRect, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const todayKey = dayKey(new Date());
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const gridStart = mondayOf(first);
    const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });

    return (
        <View style={styles.wrap}>
            <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, i) => (
                    <ThemedText key={i} type="caption" style={styles.weekday}>
                        {w}
                    </ThemedText>
                ))}
            </View>
            <View style={styles.grid}>
                {cells.map((d) => {
                    const key = dayKey(d);
                    const inMonth = d.getMonth() === monthAnchor.getMonth();
                    const isToday = key === todayKey;
                    const hovered = key === hoverKey;
                    const day = density[key];
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => onSelectDay(d)}
                            onLayout={(e) => {
                                e.currentTarget.measureInWindow((x, y, width, height) =>
                                    registerDropRect(key, { x, y, width, height })
                                );
                            }}
                            style={[
                                styles.cell,
                                { borderColor: ThemedColor.tertiary },
                                !inMonth && { opacity: 0.35 },
                                isToday && { borderColor: ThemedColor.primary, borderWidth: 1.5 },
                                hovered && {
                                    borderColor: ThemedColor.primary,
                                    borderStyle: "dashed",
                                    backgroundColor: ThemedColor.lightened,
                                },
                            ]}
                        >
                            <ThemedText type="caption">{d.getDate()}</ThemedText>
                            <DayDots density={day} />
                            {day && day.count > 3 && (
                                <ThemedText type="caption" style={{ fontSize: 9, color: ThemedColor.caption }}>
                                    +{day.count - 3}
                                </ThemedText>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: HORIZONTAL_PADDING },
    weekdayRow: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: {
        width: `${100 / 7}%`,
        minHeight: 56,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 4,
        alignItems: "flex-start",
        gap: 2,
    },
});

export default MonthGrid;
```

Note: when a cell unmounts on month change the rects are simply re-registered by the next layout pass; the parent clears the map on mode/anchor change (Task 7).

- [ ] **Step 2: Verify it compiles**

Run: `bun tsc --noEmit 2>&1 | grep MonthGrid`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(planner): month density grid" -- components/daily/MonthGrid.tsx
```

---

### Task 6: UnscheduledTray with drag + hint

**Files:**
- Create: `components/daily/UnscheduledTray.tsx`

**Interfaces:**
- Consumes: gesture-handler `GestureDetector`/`Gesture.Pan`, reanimated shared values passed from parent.
- Produces: `UnscheduledTray({ tasks, hiddenIds, onDragStart, onDragMove, onDragEnd, hintVisible })`:
  - `tasks: any[]` (render chip per task via `task.content`), `hiddenIds: Set<string>` (optimistically scheduled — filtered out).
  - `onDragStart(task: any): void`; `onDragMove(x: number, y: number): void`; `onDragEnd(task: any, x: number, y: number): void` — all called on the JS thread (`runOnJS`); coordinates are `absoluteX/absoluteY` (window space, matching `measureInWindow` rects).
  - `onPressChip(task: any): void` — plain tap; parent routes to the existing quick-schedule modal (`handleQuickSchedule(task, "deadline")`) for picking a specific time.
  - Chip drag activates after a 300ms hold (`activateAfterLongPress`) so horizontal tray scrolling and taps still work.

- [ ] **Step 1: Implement**

```tsx
// components/daily/UnscheduledTray.tsx
import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    tasks: any[];
    hiddenIds: Set<string>;
    onDragStart: (task: any) => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd: (task: any, x: number, y: number) => void;
    onPressChip: (task: any) => void;
    hintVisible: boolean;
};

const Chip = ({ task, onDragStart, onDragMove, onDragEnd, onPressChip }: Omit<Props, "tasks" | "hiddenIds" | "hintVisible"> & { task: any }) => {
    const ThemedColor = useThemeColor();
    const pan = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => runOnJS(onDragStart)(task))
        .onUpdate((e) => runOnJS(onDragMove)(e.absoluteX, e.absoluteY))
        .onEnd((e) => runOnJS(onDragEnd)(task, e.absoluteX, e.absoluteY));
    const tap = Gesture.Tap().onEnd(() => runOnJS(onPressChip)(task));

    return (
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
            <View style={[styles.chip, { borderColor: ThemedColor.tertiary, backgroundColor: ThemedColor.background }]}>
                <ThemedText type="smallerDefault" numberOfLines={1}>
                    {task.content}
                </ThemedText>
            </View>
        </GestureDetector>
    );
};

const UnscheduledTray = ({ tasks, hiddenIds, onDragStart, onDragMove, onDragEnd, onPressChip, hintVisible }: Props) => {
    const ThemedColor = useThemeColor();
    const visible = tasks.filter((t) => !hiddenIds.has(t.id));
    if (visible.length === 0) return null;

    return (
        <View style={[styles.tray, { backgroundColor: ThemedColor.lightened, borderTopColor: ThemedColor.tertiary }]}>
            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                UNSCHEDULED · {visible.length}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {visible.map((t) => (
                    <Chip key={t.id} task={t} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onPressChip={onPressChip} />
                ))}
            </ScrollView>
            {hintVisible && (
                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                    Hold and drag a task onto a day to schedule it
                </ThemedText>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    tray: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 10,
        paddingBottom: 14,
        gap: 8,
    },
    chips: { gap: 8, paddingRight: 24 },
    chip: {
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 7,
        maxWidth: 180,
    },
});

export default UnscheduledTray;
```

- [ ] **Step 2: Verify it compiles**

Run: `bun tsc --noEmit 2>&1 | grep UnscheduledTray`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(planner): unscheduled tray with drag chips and first-run hint" -- components/daily/UnscheduledTray.tsx
```

---

### Task 7: Rewire `daily.tsx` + deletions

**Files:**
- Modify: `app/(logged-in)/(tabs)/(task)/daily.tsx` (replace header/tab wiring; keep DrawerLayout shell, `useDailyTasks`, `ScheduleTaskSheet`, quick-schedule and drag-create handlers exactly as they are)
- Delete: `components/daily/DateNavBar.tsx`, `components/daily/CalendarPickerOverlay.tsx`, `components/daily/FloatingViewToggle.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–6; `updateTaskDeadlineAPI(categoryId, taskId, deadline)` from `api/task.ts`; `showToast` from `utils/showToast`; `AsyncStorage` for `planner_drag_hint_done`; existing `TaskListView`, `CalendarView`, `ScheduleTaskSheet`.
- Produces: the final screen. State model:

```
viewMode: "week" | "month"            // default "week"; deep link workspace===Calendar → week + timeline
dayDetail: "agenda" | "timeline"      // inside week mode
selectedDate / weekStart (mondayOf)   // month mode uses monthAnchor date
```

- [ ] **Step 1: Replace the screen body**

Key excerpts (full wiring — handlers kept from the current file are marked):

```tsx
// state
const [viewMode, setViewMode] = useState<"week" | "month">("week");
const [dayDetail, setDayDetail] = useState<"agenda" | "timeline">(
    params.workspace === "Calendar" ? "timeline" : "agenda"
);
const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
const weekStart = useMemo(() => mondayOf(selectedDate), [selectedDate]);
const [monthAnchor, setMonthAnchor] = useState(() => new Date());

// density range covers whichever view is live
const rangeStart = viewMode === "week" ? weekStart : new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 20);
const rangeEnd = viewMode === "week"
    ? (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d; })()
    : new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 10);
const density = useTaskCountsByDay(rangeStart, rangeEnd);

// header stepping
const handleStep = (delta: 1 | -1) => {
    if (viewMode === "week") {
        const d = new Date(selectedDate); d.setDate(d.getDate() + 7 * delta); setSelectedDate(d);
    } else {
        setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    }
};

// drag-to-schedule
const dropRects = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
const registerDropRect = useCallback((key: string, rect: any) => {
    rect ? dropRects.current.set(key, rect) : dropRects.current.delete(key);
}, []);
useEffect(() => { dropRects.current.clear(); }, [viewMode, weekStart.getTime(), monthAnchor.getTime()]);

const [hoverKey, setHoverKey] = useState<string | null>(null);
const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
const [hintDone, setHintDone] = useState(true);
useEffect(() => {
    AsyncStorage.getItem("planner_drag_hint_done").then((v) => setHintDone(v === "1"));
}, []);

const rectsArray = () =>
    Array.from(dropRects.current, ([key, r]) => ({ key, ...r }));

const handleDragMove = useCallback((x: number, y: number) => {
    setHoverKey(rectAtPoint(rectsArray(), x, y));
}, []);

const handleDragEnd = useCallback(async (task: any, x: number, y: number) => {
    const key = rectAtPoint(rectsArray(), x, y);
    setHoverKey(null);
    if (!key) return;
    const date = fromDayKey(key);
    setHiddenIds((prev) => new Set(prev).add(task.id)); // optimistic
    try {
        await updateTaskDeadlineAPI(task.categoryID, task.id, date);
        AsyncStorage.setItem("planner_drag_hint_done", "1");
        setHintDone(true);
        fetchWorkspaces(); // refresh tasks source
    } catch (e) {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(task.id); return n; }); // revert
        showToast("Couldn't schedule task", "danger");
    }
}, [fetchWorkspaces]);
```

Render tree (inside the existing DrawerLayout + top-inset View):

```tsx
<PlannerHeader
    anchorDate={viewMode === "week" ? selectedDate : monthAnchor}
    mode={viewMode}
    onStep={handleStep}
    onModeChange={setViewMode}
/>

{viewMode === "week" ? (
    <>
        <WeekStrip
            weekStart={weekStart}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            density={density}
            registerDropRect={registerDropRect}
            hoverKey={hoverKey}
        />
        <View style={styles.dayHeader}>
            <ThemedText type="defaultSemiBold">{dayLabel(selectedDate)}</ThemedText>
            <TouchableOpacity onPress={() => setDayDetail(dayDetail === "agenda" ? "timeline" : "agenda")}>
                <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                    {dayDetail === "agenda" ? "◷ Timeline" : "☰ Agenda"}
                </ThemedText>
            </TouchableOpacity>
        </View>
        {dayDetail === "agenda" ? (
            <Animated.ScrollView /* existing list scroll wiring unchanged */>
                <TaskListView /* existing props unchanged */ />
            </Animated.ScrollView>
        ) : (
            <View style={{ flex: 1 }}>
                <CalendarView /* existing props unchanged */ />
            </View>
        )}
    </>
) : (
    <MonthGrid
        monthAnchor={monthAnchor}
        density={density}
        onSelectDay={(d) => { setSelectedDate(d); setViewMode("week"); }}
        registerDropRect={registerDropRect}
        hoverKey={hoverKey}
    />
)}

<UnscheduledTray
    tasks={tasksUnscheduled}
    hiddenIds={hiddenIds}
    onDragStart={() => {}}
    onDragMove={handleDragMove}
    onDragEnd={handleDragEnd}
    onPressChip={(t) => handleQuickSchedule(t, "deadline")}
    hintVisible={!hintDone}
/>

<ScheduleTaskSheet /* unchanged */ />
```

`dayLabel` is the Today/Tomorrow/Yesterday formatter — lift `getLabel` verbatim out of `DateNavBar.tsx` into `daily.tsx` before deleting the file. Keep `handleQuickSchedule`, `handleDragCreateComplete`, `handleCreateNewFromRange`, the `InteractionManager` deferral for `CalendarView` (now keyed on `dayDetail === "timeline"`), and `useDailyTasks` usage untouched. Drop `centerDate`/`handleDateChange` paging logic (WeekStrip replaces it — `setSelectedDate` directly). The tray sits after the content so it pins to the bottom; timeline mode keeps the tray visible.

- [ ] **Step 2: Delete the replaced components and their imports**

```bash
git rm components/daily/DateNavBar.tsx components/daily/CalendarPickerOverlay.tsx components/daily/FloatingViewToggle.tsx
grep -rn "DateNavBar\|CalendarPickerOverlay\|FloatingViewToggle" app components  # expect: no hits
```

- [ ] **Step 3: Verify**

Run: `bun tsc --noEmit 2>&1 | grep -v DatePager` → no new errors.
Run: `bun run test` → same failure set as main (no new failures).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(planner): week-first calendar page with month view and drag-to-schedule" -- "app/(logged-in)/(tabs)/(task)/daily.tsx" components/daily/DateNavBar.tsx components/daily/CalendarPickerOverlay.tsx components/daily/FloatingViewToggle.tsx
```

---

### Task 8: Manual verification pass

- [ ] Launch the app, open the Daily/Planner page. Confirm: opens in Week mode on today; strip dots match task days; chevrons step weeks; Month toggle shows grid; tapping a month cell returns to Week with that day selected.
- [ ] Drag a chip from the tray onto a strip day → task disappears from tray, appears in that day's agenda after refresh; hint line disappears permanently (relaunch to confirm).
- [ ] Force a failure (airplane mode) → chip returns, toast shows.
- [ ] Timeline button → hour grid renders, drag-create still opens ScheduleTaskSheet; Agenda button returns.
- [ ] Deep link `params.workspace === "Calendar"` still lands on the timeline.
- [ ] Dark mode: strip/grid/tray all follow the theme toggle in settings.

No commit — fix-forward anything found, then re-run Task 7 Step 3 verification.
