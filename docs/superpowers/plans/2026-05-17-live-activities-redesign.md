# Live Activities Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the encouragement-triggered live activity with two rich, purpose-built live activities: Active Task Timer and Deadline Countdown, with backend auto-triggering via push notifications.

**Architecture:** Two new expo-widgets live activity components using SwiftUI primitives (Text timer, ProgressView, Gauge). Backend cron handlers query for tasks hitting their startTime or approaching deadline and send push notifications. Frontend notification handler intercepts these pushes and starts the corresponding live activity. Manual triggering via task detail page buttons.

**Tech Stack:** expo-widgets + @expo/ui/swift-ui (live activity UI), Go + MongoDB (backend cron/queries), expo-notifications (push handling)

**Spec:** `docs/superpowers/specs/2026-05-17-live-activities-redesign.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/internal/handlers/task/live_activity.go` | **Create** — Query helpers + notification sending for startTime and deadline-approaching tasks |
| `backend/internal/handlers/task/cron.go` | **Modify** — Wire new handlers into the 1-minute cron cycle |
| `frontend/widgets/ActiveTaskActivity.tsx` | **Create** — Active task live activity widget (timer, progress, CTAs) |
| `frontend/widgets/DeadlineCountdownActivity.tsx` | **Rewrite** — Redesigned deadline countdown with new props and escalating urgency |
| `frontend/widgets/EncouragementActivity.tsx` | **Delete** |
| `frontend/widgets/widgetUpdaters.ts` | **Modify** — Add ActiveTask factory, remove Encouragement factory |
| `frontend/contexts/kudosContext.tsx` | **Modify** — Remove all live activity code |
| `frontend/app/(logged-in)/_layout.tsx` | **Modify** — Handle `live_activity` push type in notification listener |
| `frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx` | **Modify** — Add "Start Working" button, update deadline tracking to use new activity |

---

### Task 1: Backend — Live Activity Query Helpers and Notification Sending

**Files:**
- Create: `backend/internal/handlers/task/live_activity.go`

- [ ] **Step 1: Create the live activity handler file**

Create `backend/internal/handlers/task/live_activity.go` with two query functions and two handler functions. The queries use the same `getBaseTaskPipeline()` pattern as `GetTasksWithPastReminders()` in `reminder.go`. The handlers follow the same pattern as `HandleCheckin()` — query tasks, look up user push tokens, send batch notifications.

```go
package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

// GetTasksWithStartTimeInWindow finds active, incomplete tasks whose startTime
// falls within [windowStart, windowEnd). Uses the same unwind pipeline as reminders.
func (s *Service) GetTasksWithStartTimeInWindow(windowStart, windowEnd time.Time) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getBaseTaskPipeline()
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{
		"startTime": bson.M{
			"$gte": windowStart,
			"$lt":  windowEnd,
		},
		"active":        true,
		"timeCompleted": bson.M{"$eq": nil},
	}}})

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// GetTasksWithDeadlineApproaching finds active, incomplete tasks whose deadline
// falls within [windowStart, windowEnd). Used to find tasks ~1 hour before deadline.
func (s *Service) GetTasksWithDeadlineApproaching(windowStart, windowEnd time.Time) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getBaseTaskPipeline()
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{
		"deadline": bson.M{
			"$gte": windowStart,
			"$lt":  windowEnd,
		},
		"active":        true,
		"timeCompleted": bson.M{"$eq": nil},
	}}})

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// getCategoryWorkspaceName looks up the workspaceName for a category by its ID.
func (s *Service) getCategoryWorkspaceName(categoryID interface{}) string {
	ctx := context.Background()
	var cat struct {
		WorkspaceName string `bson:"workspaceName"`
	}
	err := s.Tasks.FindOne(ctx, bson.M{"_id": categoryID}).Decode(&cat)
	if err != nil {
		return "Tasks"
	}
	if cat.WorkspaceName == "" {
		return "Tasks"
	}
	return cat.WorkspaceName
}

// HandleStartTimeNotifications sends push notifications for tasks whose startTime
// just arrived, triggering the Active Task live activity on the frontend.
func (h *Handler) HandleStartTimeNotifications() (fiber.Map, error) {
	now := xutils.NowUTC()
	windowStart := now.Add(-2 * time.Minute) // 2-min window for safety
	windowEnd := now

	tasks, err := h.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	if err != nil {
		return fiber.Map{"error": err.Error()}, err
	}

	if len(tasks) == 0 {
		return fiber.Map{"notifications_sent": 0}, nil
	}

	sent := 0
	for _, task := range tasks {
		user, err := h.service.Users.GetUserByID(context.Background(), task.UserID)
		if err != nil || user.PushToken == "" {
			continue
		}

		workspaceName := h.service.getCategoryWorkspaceName(task.CategoryID)

		endTime := ""
		if task.Deadline != nil {
			endTime = task.Deadline.Format(time.RFC3339)
		}

		err = xutils.SendNotification(xutils.Notification{
			Token:   user.PushToken,
			Title:   fmt.Sprintf("Time to start: %s", task.Content),
			Message: "Your task is starting now",
			Data: map[string]string{
				"type":            "live_activity",
				"liveActivityType": "activeTask",
				"taskId":          task.ID.Hex(),
				"categoryId":     task.CategoryID.Hex(),
				"taskName":       task.Content,
				"workspaceName":  workspaceName,
				"startTime":     task.StartTime.Format(time.RFC3339),
				"endTime":       endTime,
			},
		})
		if err != nil {
			slog.Error("Failed to send start-time live activity notification",
				"error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
			continue
		}
		sent++
	}

	return fiber.Map{"notifications_sent": sent, "tasks_found": len(tasks)}, nil
}

// HandleDeadlineApproachingNotifications sends push notifications for tasks whose
// deadline is ~1 hour away, triggering the Deadline Countdown live activity.
func (h *Handler) HandleDeadlineApproachingNotifications() (fiber.Map, error) {
	now := xutils.NowUTC()
	// Window: deadline is between 59 and 61 minutes from now
	windowStart := now.Add(59 * time.Minute)
	windowEnd := now.Add(61 * time.Minute)

	tasks, err := h.service.GetTasksWithDeadlineApproaching(windowStart, windowEnd)
	if err != nil {
		return fiber.Map{"error": err.Error()}, err
	}

	if len(tasks) == 0 {
		return fiber.Map{"notifications_sent": 0}, nil
	}

	sent := 0
	for _, task := range tasks {
		user, err := h.service.Users.GetUserByID(context.Background(), task.UserID)
		if err != nil || user.PushToken == "" {
			continue
		}

		workspaceName := h.service.getCategoryWorkspaceName(task.CategoryID)

		err = xutils.SendNotification(xutils.Notification{
			Token:   user.PushToken,
			Title:   fmt.Sprintf("%s due in 1 hour", task.Content),
			Message: "Deadline approaching",
			Data: map[string]string{
				"type":            "live_activity",
				"liveActivityType": "deadlineCountdown",
				"taskId":          task.ID.Hex(),
				"categoryId":     task.CategoryID.Hex(),
				"taskName":       task.Content,
				"workspaceName":  workspaceName,
				"deadline":       task.Deadline.Format(time.RFC3339),
				"priority":       fmt.Sprintf("%d", task.Priority),
			},
		})
		if err != nil {
			slog.Error("Failed to send deadline live activity notification",
				"error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
			continue
		}
		sent++
	}

	return fiber.Map{"notifications_sent": sent, "tasks_found": len(tasks)}, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: clean build, no errors

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/task/live_activity.go
git commit -m "feat(backend): add live activity notification queries and handlers"
```

---

### Task 2: Backend — Wire Live Activity Handlers into Cron

**Files:**
- Modify: `backend/internal/handlers/task/cron.go:52-78`

- [ ] **Step 1: Add live activity handlers to the cron function**

In `cron.go`, add two new handler calls after the `/* Checkins */` section (after line 78, before the closing `})`):

```go
		/* Live Activity Notifications */

		startTimeResult, err := handler.HandleStartTimeNotifications()
		if err != nil {
			slog.Error("Error handling start-time live activity notifications", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: start-time live activity handling failed: %w", err))
		}
		if notifCount, ok := startTimeResult["notifications_sent"].(int); ok && notifCount > 0 {
			slog.Info("Start-time live activity notifications sent", "count", notifCount)
		}

		deadlineResult, err := handler.HandleDeadlineApproachingNotifications()
		if err != nil {
			slog.Error("Error handling deadline live activity notifications", "error", err)
			sentry.CaptureException(fmt.Errorf("cron: deadline live activity handling failed: %w", err))
		}
		if notifCount, ok := deadlineResult["notifications_sent"].(int); ok && notifCount > 0 {
			slog.Info("Deadline live activity notifications sent", "count", notifCount)
		}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/task/cron.go
git commit -m "feat(backend): wire live activity notifications into cron cycle"
```

---

### Task 3: Frontend — Create ActiveTaskActivity Widget

**Files:**
- Create: `frontend/widgets/ActiveTaskActivity.tsx`

- [ ] **Step 1: Create the active task live activity component**

This follows the exact same pattern as the existing `EncouragementActivity.tsx` and `DeadlineCountdownActivity.tsx` — a `'widget'` directive, SwiftUI imports, and `createLiveActivity()`.

```tsx
'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, frame, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type ActiveTaskActivityProps = {
    taskName: string;
    workspaceName: string;
    startTime: string;
    endTime?: string;
    hasEndTime: boolean;
    categoryId: string;
    taskId: string;
};

const ActiveTaskActivityComponent = (props: ActiveTaskActivityProps) => {
    'widget';

    const PURPLE = '#8B5CF6';
    const GREEN = '#22C55E';
    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
    const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

    const { taskName, workspaceName, startTime, endTime, hasEndTime, categoryId, taskId } = props;
    const startDate = new Date(startTime);
    const endDate = hasEndTime && endTime ? new Date(endTime) : undefined;
    const deepLink = `kindred://task/${categoryId}/${taskId}`;

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 }), widgetURL(deepLink)]}>
                {/* Status row */}
                <HStack>
                    <Image systemName="circle.fill" color={GREEN} size={8} />
                    <Text modifiers={[
                        font({ weight: 'semibold', size: 12 }),
                        foregroundStyle(GREEN),
                    ]}>
                        ACTIVE
                    </Text>
                    <Spacer />
                    {hasEndTime && endDate ? (
                        <Text
                            date={startDate}
                            dateStyle="timer"
                            modifiers={[
                                font({ weight: 'bold', size: 24, design: 'rounded' }),
                                foregroundStyle(PURPLE),
                            ]}
                        />
                    ) : (
                        <VStack>
                            <Text
                                date={startDate}
                                dateStyle="timer"
                                modifiers={[
                                    font({ weight: 'bold', size: 24, design: 'rounded' }),
                                    foregroundStyle(PURPLE),
                                ]}
                            />
                            <Text modifiers={[font({ size: 10 }), tertiary]}>
                                elapsed
                            </Text>
                        </VStack>
                    )}
                </HStack>
                {/* Task info */}
                <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                {/* Progress bar — only when end time exists */}
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}
            </VStack>
        ),
        compactLeading: (
            <HStack>
                <Image systemName="circle.fill" color={GREEN} size={6} />
                <Text modifiers={[font({ weight: 'semibold', size: 13 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={startDate}
                dateStyle="timer"
                modifiers={[
                    font({ weight: 'bold', size: 14, design: 'rounded' }),
                    foregroundStyle(PURPLE),
                ]}
            />
        ),
        minimal: (
            <Image systemName="bolt.fill" color={PURPLE} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={GREEN} size={8} />
                <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(GREEN)]}>
                    Active
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text
                    date={startDate}
                    dateStyle="timer"
                    modifiers={[
                        font({ weight: 'bold', size: 22, design: 'rounded' }),
                        foregroundStyle(PURPLE),
                    ]}
                />
                {hasEndTime ? (
                    <Text modifiers={[font({ size: 10 }), secondary]}>
                        remaining
                    </Text>
                ) : (
                    <Text modifiers={[font({ size: 10 }), secondary]}>
                        elapsed
                    </Text>
                )}
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 14 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                {hasEndTime && endDate ? (
                    <ProgressView
                        timerInterval={{ lower: startDate, upper: endDate }}
                        countsDown={false}
                    />
                ) : null}
            </VStack>
        ),
    };
};

export default createLiveActivity('ActiveTaskActivity', ActiveTaskActivityComponent);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/widgets/ActiveTaskActivity.tsx
git commit -m "feat(widgets): create ActiveTaskActivity live activity component"
```

---

### Task 4: Frontend — Rewrite DeadlineCountdownActivity Widget

**Files:**
- Modify: `frontend/widgets/DeadlineCountdownActivity.tsx`

- [ ] **Step 1: Rewrite the deadline countdown with new design and props**

Replace the entire file. The new version uses the same visual language as the active task (circular gauge style via ProgressView, status dot), adds `categoryId`/`taskId` for deep linking, removes the manual `timeRemainingLabel` in favor of native `Text date` timer, and introduces color escalation props.

```tsx
'widget';

import React from 'react';
import { Text, VStack, HStack, Image, ProgressView, Spacer } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type DeadlineCountdownProps = {
    taskName: string;
    workspaceName: string;
    deadline: string;
    priority: number;
    categoryId: string;
    taskId: string;
    accentColor: string;   // Updated by frontend: '#8B5CF6' | '#F59E0B' | '#6B7280'
    statusLabel: string;   // Updated by frontend: 'Due Soon' | 'Overdue'
};

const DeadlineCountdownComponent = (props: DeadlineCountdownProps) => {
    'widget';

    const primary = foregroundStyle({ type: 'hierarchical', style: 'primary' });
    const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

    const { taskName, workspaceName, deadline, priority, categoryId, taskId, accentColor, statusLabel } = props;
    const deadlineDate = new Date(deadline);
    const deepLink = `kindred://task/${categoryId}/${taskId}`;

    // 1 hour before deadline as the start of the countdown window
    const countdownStart = new Date(deadlineDate.getTime() - 60 * 60 * 1000);

    const PRIORITY_LABELS = ['', 'Low', 'Medium', 'High'];
    const priorityLabel = PRIORITY_LABELS[Math.min(priority, 3)];

    return {
        banner: (
            <VStack modifiers={[padding({ horizontal: 16, vertical: 14 }), widgetURL(deepLink)]}>
                {/* Status row */}
                <HStack>
                    <Image systemName="circle.fill" color={accentColor} size={8} />
                    <Text modifiers={[
                        font({ weight: 'semibold', size: 12 }),
                        foregroundStyle(accentColor),
                    ]}>
                        {statusLabel.toUpperCase()}
                    </Text>
                    <Spacer />
                    {/* Countdown timer */}
                    <Text
                        date={deadlineDate}
                        dateStyle="timer"
                        modifiers={[
                            font({ weight: 'bold', size: 24, design: 'rounded' }),
                            foregroundStyle(accentColor),
                        ]}
                    />
                </HStack>
                {/* Task info */}
                <Text modifiers={[font({ weight: 'semibold', size: 17 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <HStack>
                    <Text modifiers={[font({ size: 13 }), secondary]}>
                        {workspaceName}
                    </Text>
                    {priorityLabel ? (
                        <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(accentColor)]}>
                            {priorityLabel}
                        </Text>
                    ) : null}
                </HStack>
                {/* Depleting progress bar */}
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />
            </VStack>
        ),
        compactLeading: (
            <HStack>
                <Image systemName="circle.fill" color={accentColor} size={6} />
                <Text modifiers={[font({ weight: 'semibold', size: 13 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
            </HStack>
        ),
        compactTrailing: (
            <Text
                date={deadlineDate}
                dateStyle="timer"
                modifiers={[
                    font({ weight: 'bold', size: 14, design: 'rounded' }),
                    foregroundStyle(accentColor),
                ]}
            />
        ),
        minimal: (
            <Image systemName="clock.fill" color={accentColor} />
        ),
        expandedLeading: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Image systemName="circle.fill" color={accentColor} size={8} />
                <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(accentColor)]}>
                    {statusLabel}
                </Text>
            </VStack>
        ),
        expandedTrailing: (
            <VStack modifiers={[padding({ all: 8 })]}>
                <Text
                    date={deadlineDate}
                    dateStyle="timer"
                    modifiers={[
                        font({ weight: 'bold', size: 22, design: 'rounded' }),
                        foregroundStyle(accentColor),
                    ]}
                />
                <Text modifiers={[font({ size: 10 }), secondary]}>
                    remaining
                </Text>
            </VStack>
        ),
        expandedBottom: (
            <VStack modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
                <Text modifiers={[font({ weight: 'semibold', size: 14 }), primary, lineLimit(1)]}>
                    {taskName}
                </Text>
                <Text modifiers={[font({ size: 13 }), secondary]}>
                    {workspaceName}
                </Text>
                <ProgressView
                    timerInterval={{ lower: countdownStart, upper: deadlineDate }}
                    countsDown={true}
                />
            </VStack>
        ),
    };
};

export default createLiveActivity('DeadlineCountdownActivity', DeadlineCountdownComponent);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/widgets/DeadlineCountdownActivity.tsx
git commit -m "feat(widgets): redesign DeadlineCountdownActivity with timer and color escalation"
```

---

### Task 5: Frontend — Update widgetUpdaters.ts

**Files:**
- Modify: `frontend/widgets/widgetUpdaters.ts`

- [ ] **Step 1: Add ActiveTask factory and remove Encouragement factory**

In `frontend/widgets/widgetUpdaters.ts`:

1. Replace the `EncouragementActivityProps` import with `ActiveTaskActivityProps`:

```typescript
// OLD
import type { EncouragementActivityProps } from './EncouragementActivity';
// NEW
import type { ActiveTaskActivityProps } from './ActiveTaskActivity';
```

2. Replace the `EncouragementActivityFactory` with `ActiveTaskActivityFactory`:

```typescript
// OLD
export const EncouragementActivityFactory = createLiveActivityFactory<EncouragementActivityProps>(
    'EncouragementActivity',
    () => require('./EncouragementActivity').default,
);
// NEW
export const ActiveTaskActivityFactory = createLiveActivityFactory<ActiveTaskActivityProps>(
    'ActiveTaskActivity',
    () => require('./ActiveTaskActivity').default,
);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/widgets/widgetUpdaters.ts
git commit -m "feat(widgets): add ActiveTask factory, remove Encouragement factory"
```

---

### Task 6: Frontend — Remove Encouragement Live Activity from KudosContext

**Files:**
- Modify: `frontend/contexts/kudosContext.tsx`

- [ ] **Step 1: Remove all live activity imports and code**

In `frontend/contexts/kudosContext.tsx`:

1. Remove the import on line 5:
```typescript
// DELETE this line:
import { EncouragementActivityFactory as EncouragementActivity } from "@/widgets/widgetUpdaters";
```

2. Remove the `liveActivityTimeoutRef` ref declaration (line 72):
```typescript
// DELETE this line:
const liveActivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

3. Remove the cleanup useEffect (lines 85-91):
```typescript
// DELETE this block:
useEffect(() => {
    return () => {
        if (liveActivityTimeoutRef.current) {
            clearTimeout(liveActivityTimeoutRef.current);
        }
    };
}, []);
```

4. Remove the live activity trigger block inside `fetchKudosData` (lines 113-148, from `const newUnreadEncouragements` through the `if (latestItem)` block closing brace). Keep the `setEncouragements` and `setCongratulations` calls. Replace lines 112-148 with just the `seenKudosIds` tracking:

```typescript
            setEncouragements(sortedEncouragements);
            setCongratulations(sortedCongratulations);

            [...sortedEncouragements, ...sortedCongratulations].forEach(k => seenKudosIds.current.add(k.id));
```

- [ ] **Step 2: Verify no remaining references to live activity in the file**

Run: `grep -n "liveActivity\|LiveActivity\|EncouragementActivity" frontend/contexts/kudosContext.tsx`
Expected: no matches

- [ ] **Step 3: Commit**

```bash
git add frontend/contexts/kudosContext.tsx
git commit -m "refactor(kudos): remove live activity triggering from kudos context"
```

---

### Task 7: Frontend — Delete EncouragementActivity.tsx

**Files:**
- Delete: `frontend/widgets/EncouragementActivity.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm frontend/widgets/EncouragementActivity.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -rn "EncouragementActivity" frontend/ --include="*.ts" --include="*.tsx"`
Expected: no matches (all references were removed in Tasks 5 and 6)

- [ ] **Step 3: Commit**

```bash
git add frontend/widgets/EncouragementActivity.tsx
git commit -m "chore: delete EncouragementActivity live activity"
```

---

### Task 8: Frontend — Handle Live Activity Push Notifications

**Files:**
- Modify: `frontend/app/(logged-in)/_layout.tsx:17-23` (imports) and `frontend/app/(logged-in)/_layout.tsx:175-201` (notification listeners)

- [ ] **Step 1: Add live activity factory imports**

At the top of `frontend/app/(logged-in)/_layout.tsx`, add after the existing imports (around line 35):

```typescript
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import { DeadlineCountdownActivityFactory } from "@/widgets/widgetUpdaters";
import type { ActiveTaskActivityProps } from "@/widgets/ActiveTaskActivity";
import type { DeadlineCountdownProps } from "@/widgets/DeadlineCountdownActivity";
```

- [ ] **Step 2: Add live activity handler inside the notification listener**

In the `addNotificationListener` callback (around line 177), add a handler for `live_activity` type **before** the existing toast logic. The modified callback should be:

```typescript
        notificationListener.current = addNotificationListener((notification) => {
            const data = notification.request.content.data;

            // Handle live activity triggers from push notifications
            if (data?.type === 'live_activity') {
                if (data.liveActivityType === 'activeTask') {
                    ActiveTaskActivityFactory.start({
                        taskName: data.taskName || '',
                        workspaceName: data.workspaceName || 'Tasks',
                        startTime: data.startTime || new Date().toISOString(),
                        endTime: data.endTime || undefined,
                        hasEndTime: !!data.endTime,
                        categoryId: data.categoryId || '',
                        taskId: data.taskId || '',
                    });
                } else if (data.liveActivityType === 'deadlineCountdown') {
                    DeadlineCountdownActivityFactory.start({
                        taskName: data.taskName || '',
                        workspaceName: data.workspaceName || 'Tasks',
                        deadline: data.deadline || '',
                        priority: parseInt(data.priority || '0', 10),
                        categoryId: data.categoryId || '',
                        taskId: data.taskId || '',
                        accentColor: '#8B5CF6',
                        statusLabel: 'Due Soon',
                    });
                }
                return; // Don't show toast for live activity pushes
            }

            if (data?.type === 'encouragement' || data?.type === 'congratulation') {
                fetchKudosData();
            }
            showToastable({
                message: notification.request.content.body || "New notification",
                title: notification.request.content.title || "Notification",
                status: "neutral" as any,
                duration: 3000,
                renderContent: (props) => <DefaultToast {...props} />,
                onPress: () => {
                    if (data?.url) {
                        router.push(data.url);
                    }
                }
            });
        });
```

- [ ] **Step 3: Add live activity start on notification tap (response listener)**

In the `addNotificationResponseListener` callback (around line 196), add handling for live activity notifications so tapping the push also starts the activity:

```typescript
        responseListener.current = addNotificationResponseListener((response) => {
            const data = response.notification.request.content.data;

            // Start live activity when user taps the notification
            if (data?.type === 'live_activity') {
                if (data.liveActivityType === 'activeTask') {
                    ActiveTaskActivityFactory.start({
                        taskName: data.taskName || '',
                        workspaceName: data.workspaceName || 'Tasks',
                        startTime: data.startTime || new Date().toISOString(),
                        endTime: data.endTime || undefined,
                        hasEndTime: !!data.endTime,
                        categoryId: data.categoryId || '',
                        taskId: data.taskId || '',
                    });
                } else if (data.liveActivityType === 'deadlineCountdown') {
                    DeadlineCountdownActivityFactory.start({
                        taskName: data.taskName || '',
                        workspaceName: data.workspaceName || 'Tasks',
                        deadline: data.deadline || '',
                        priority: parseInt(data.priority || '0', 10),
                        categoryId: data.categoryId || '',
                        taskId: data.taskId || '',
                        accentColor: '#8B5CF6',
                        statusLabel: 'Due Soon',
                    });
                }
                // Also navigate to the task
                if (data.categoryId && data.taskId) {
                    router.push(`/(logged-in)/(tabs)/(task)/task/${data.taskId}?categoryId=${data.categoryId}&name=${encodeURIComponent(data.taskName || '')}`);
                }
                return;
            }

            if (data?.url) {
                router.push(data.url);
            }
        });
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(logged-in\)/_layout.tsx
git commit -m "feat(notifications): handle live_activity push type to start live activities"
```

---

### Task 9: Frontend — Update Task Detail Page

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx`

- [ ] **Step 1: Update imports**

Replace the existing deadline-only imports with both activity factories. Change lines 51-53:

```typescript
// OLD
import { DeadlineCountdownActivityFactory as DeadlineCountdownActivity } from "@/widgets/widgetUpdaters";
import type { DeadlineCountdownProps } from "@/widgets/DeadlineCountdownActivity";
import type { LiveActivity } from "expo-widgets";

// NEW
import { DeadlineCountdownActivityFactory, ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import type { DeadlineCountdownProps } from "@/widgets/DeadlineCountdownActivity";
import type { ActiveTaskActivityProps } from "@/widgets/ActiveTaskActivity";
import type { LiveActivity } from "expo-widgets";
```

- [ ] **Step 2: Add active task live activity state**

After line 75 (`const [deadlineLiveActivity, setDeadlineLiveActivity] = ...`), add:

```typescript
    const [activeTaskLiveActivity, setActiveTaskLiveActivity] = useState<LiveActivity<ActiveTaskActivityProps> | null>(null);
```

- [ ] **Step 3: Add handleStartWorking function**

After the `handleTrackDeadline` function (around line 166), add:

```typescript
    const handleStartWorking = () => {
        if (!task) return;

        // If already tracking, stop the activity
        if (activeTaskLiveActivity) {
            activeTaskLiveActivity.end('immediate');
            setActiveTaskLiveActivity(null);
            return;
        }

        const now = new Date().toISOString();
        const endTime = task.deadline || undefined;

        const instance = ActiveTaskActivityFactory.start({
            taskName: task.content,
            workspaceName: task.workspaceName || 'Tasks',
            startTime: now,
            endTime,
            hasEndTime: !!endTime,
            categoryId: categoryId as string,
            taskId: id as string,
        });
        setActiveTaskLiveActivity(instance);

        // Also start the in-app timer
        startTimer(id);
    };
```

- [ ] **Step 4: Update handleTrackDeadline to use new props**

Replace the existing `handleTrackDeadline` function (lines 140-166) with:

```typescript
    const handleTrackDeadline = () => {
        if (!task?.deadline) return;
        if (deadlineLiveActivity) {
            deadlineLiveActivity.end('immediate');
            setDeadlineLiveActivity(null);
            return;
        }

        const instance = DeadlineCountdownActivityFactory.start({
            taskName: task.content,
            workspaceName: task.workspaceName || 'Tasks',
            deadline: task.deadline,
            priority: task.priority || 0,
            categoryId: categoryId as string,
            taskId: id as string,
            accentColor: '#8B5CF6',
            statusLabel: 'Due Soon',
        });
        setDeadlineLiveActivity(instance);
    };
```

- [ ] **Step 5: End active task live activity on completion and cleanup**

Update `handleMarkAsCompleted` (around line 406) to also end the active task activity:

```typescript
    const handleMarkAsCompleted = () => {
        capture(AnalyticsEvents.TASK_COMPLETED, { source: "detail_button" });
        if (task && categoryId && id) {
            // End live activities if active
            if (deadlineLiveActivity) {
                deadlineLiveActivity.end('immediate');
                setDeadlineLiveActivity(null);
            }
            if (activeTaskLiveActivity) {
                activeTaskLiveActivity.end('immediate');
                setActiveTaskLiveActivity(null);
            }
            markTaskAsCompleted(categoryId as string, id as string, {
                id: task.id,
                content: task.content,
                value: task.value,
                public: task.public,
            });
        }
    };
```

Update the cleanup useEffect (lines 169-178) to also clean up active task activity:

```typescript
    useEffect(() => {
        return () => {
            if (deadlineLiveActivity) {
                deadlineLiveActivity.end('immediate');
            }
            if (activeTaskLiveActivity) {
                activeTaskLiveActivity.end('immediate');
            }
        };
    }, [deadlineLiveActivity, activeTaskLiveActivity]);
```

- [ ] **Step 6: Add "Start Working" button to the UI**

Add a "Start Working" / "Stop Working" button before the "Mark as Completed" button. Find the `key="mark-complete"` View (around line 742) and add before it:

```tsx
                                <View key="start-working" style={{ marginTop: 0 }}>
                                    <PrimaryButton
                                        title={activeTaskLiveActivity ? "Stop Working" : "Start Working"}
                                        secondary={!activeTaskLiveActivity}
                                        style={{
                                            boxShadow: "0px 0px 10px 0px rgba(0, 0, 0, 0.1)",
                                        }}
                                        onPress={handleStartWorking}
                                    />
                                </View>
```

- [ ] **Step 7: Remove the old deadline interval update logic**

Remove the `deadlineIntervalRef` ref (line 76) and the interval-based update logic. Since the new `DeadlineCountdownActivity` uses native `Text date` timers, no manual interval is needed. Delete:

```typescript
// DELETE these:
const deadlineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

And remove any `deadlineIntervalRef.current` references in `handleTrackDeadline`, `handleMarkAsCompleted`, and the cleanup useEffect (the interval clear calls). The new `handleTrackDeadline` in Step 4 already omits the interval.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/\(logged-in\)/\(tabs\)/\(task\)/task/\[id\].tsx
git commit -m "feat(task-detail): add Start Working button and update live activity integration"
```

---

### Task 10: Frontend — Deadline Color Escalation Updates

**Files:**
- Modify: `frontend/app/(logged-in)/_layout.tsx`

- [ ] **Step 1: Add color escalation interval for active deadline activities**

The deadline countdown activity needs periodic prop updates to change the accent color at threshold boundaries (10 min → amber, overdue → gray). Add a helper that runs in the notification handler.

After starting a deadline countdown activity in the notification listener, set up an interval to update colors:

In the `addNotificationListener` callback, after the `DeadlineCountdownActivityFactory.start(...)` call, add:

```typescript
                    // Set up color escalation updates
                    const deadlineMs = new Date(data.deadline).getTime();
                    const escalationInterval = setInterval(() => {
                        const remaining = deadlineMs - Date.now();
                        let accentColor = '#8B5CF6'; // purple
                        let statusLabel = 'Due Soon';
                        if (remaining <= 0) {
                            accentColor = '#6B7280'; // gray
                            statusLabel = 'Overdue';
                        } else if (remaining <= 10 * 60 * 1000) {
                            accentColor = '#F59E0B'; // amber
                        }

                        // Get running instances and update them
                        const instances = DeadlineCountdownActivityFactory.getInstances();
                        for (const inst of instances) {
                            inst.update({
                                taskName: data.taskName || '',
                                workspaceName: data.workspaceName || 'Tasks',
                                deadline: data.deadline || '',
                                priority: parseInt(data.priority || '0', 10),
                                categoryId: data.categoryId || '',
                                taskId: data.taskId || '',
                                accentColor,
                                statusLabel,
                            });
                        }

                        // Auto-dismiss 30 min after overdue
                        if (remaining <= -30 * 60 * 1000) {
                            for (const inst of instances) {
                                inst.end('default');
                            }
                            clearInterval(escalationInterval);
                        }
                    }, 60 * 1000); // Check every minute
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/\(logged-in\)/_layout.tsx
git commit -m "feat(notifications): add deadline color escalation and auto-dismiss"
```
