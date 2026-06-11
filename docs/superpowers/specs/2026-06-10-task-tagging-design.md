# Task Tagging Design

**Date:** 2026-06-10
**Status:** Approved

## Overview

Users can tag friends in their tasks. The tagged person becomes an accountability witness — they're notified when the task is created, can choose to Watch or Copy the task, and are pinged on completion. The tagger sees watchers reflected on their task using the existing encouragements glow-icon UI.

---

## Data Model

One new field on the `Task` type:

```ts
taggedUsers: {
  id: string
  handle: string
  display_name: string
  status: 'pending' | 'watching' | 'copied' | 'untagged'
}[]
```

**Status meanings:**
- `pending` — tagged, no response yet
- `watching` — responded Watch; receives completion pings
- `copied` — responded Copy; has their own task, no further prompts or pings on the original
- `untagged` — dismissed; never re-prompted, never pinged

The backend excludes `untagged` entries from all social display and notification logic.

### New Notification Types

Added alongside existing `post_tag`:

| Type | Recipient | Trigger |
|---|---|---|
| `task_tagged` | Tagged user | Tagger saves a task with them tagged |
| `task_copied` | Tagger | Tagged user responds Copy |
| `task_completed_watcher` | All `watching` users | Task marked complete |

---

## Tagger Flow

### Entry point 1 — During task creation
A "Tag a friend" field at the bottom of the create task sheet, styled consistently with existing deadline/reminder fields. Tapping opens the existing `tag-people.tsx` screen (reused from posts). Multiple friends can be tagged. Selected friends render as avatar chips inline in the create sheet.

### Entry point 2 — On an existing task
A tag icon (person+) in the task detail action row. Tapping opens `tag-people.tsx` with already-tagged users pre-selected. Adding or removing tags from here updates `taggedUsers` in place.

### Visibility after tagging
Watchers are reflected using the existing encouragements glow-icon treatment on the task row, right-aligned. No new UI is added — the existing social signal accumulates watchers alongside encouragements. `pending` and `watching` users contribute to the count. `untagged` users do not.

---

## Tagged Person Flow

1. Tagged person receives a `task_tagged` push notification.
2. Opening the app shows a persistent banner at the top of the Home screen:
   - Top hairline in brand purple
   - Avatar + **"[Name] tagged you in a task"** + task name/points beneath
   - Three text actions: **Watch** (purple, primary) · Copy · Untag me
3. The banner persists until the user responds. Multiple pending tags stack, most recent first. For recurring tasks, the banner is tied to the tag relationship — it shows once, not once per recurrence.

### Watch
- Status → `watching`
- Banner dismissed
- User receives a `task_completed_watcher` push on every future completion of the task

### Copy
- Opens the create task sheet pre-filled with the original task's `content`, `value`, `deadline`, `notes`, `checklist`, and recurrence settings
- User selects their own workspace and category
- On save: status → `copied`, tagger receives `task_copied` push: *"[Name] copied your task 💪"*
- No further banners or pings from the original task — they have their own version

### Untag me
- Status → `untagged`
- Banner dismissed silently
- Tagger is not notified
- User is never re-prompted or pinged for this task, including future recurrences

---

## Completion Flow

When a task is marked complete, the backend:
1. Finds all `taggedUsers` with status `watching`
2. Sends each a `task_completed_watcher` push: *"[Tagger] completed '[Task name]' 🎉"*

### Recurring task rules
- `watching` → pinged on every completion, indefinitely
- `copied` → never pinged on the original's completions; their own recurring task runs independently
- `untagged` → never pinged, ever
- `pending` (never responded) → pinged on every completion; banner persists on home screen

---

## Reused Infrastructure

| Existing piece | Reused for |
|---|---|
| `tag-people.tsx` + `useFriendsForMention()` | Friend picker for tagging |
| `TaggedUsersChips` | Avatar chips in create task sheet |
| Encouragements glow-icon on task row | Watcher count display |
| Push notification system (`notificationService.ts`) | All three new notification types |
| Create task sheet (FAB flow) | Pre-filled copy flow |

---

## Out of Scope (v1)

- A dedicated "tasks I'm watching" feed
- Tagging non-friends (public tasks)
- Removing a tag after the tagged person has already responded
- Group tags (tagging a whole friend group at once)
