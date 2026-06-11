package Post

// taskSlotInterval reserves every Nth feed slot for a task
// (0-indexed positions 5, 11, 17 on a 20-item page ≈ 17% tasks).
const taskSlotInterval = 6

// interleaveFeedItems merges chronological items (posts + ring closures)
// with sampled tasks: tasks take the reserved slots in draw order. If posts
// run out, remaining tasks fill the tail; if tasks run out, posts fill through.
func interleaveFeedItems(chronological []FeedItem, tasks []FeedTaskData, limit int) []FeedItem {
	items := make([]FeedItem, 0, limit)
	ci, ti := 0, 0
	for len(items) < limit && (ci < len(chronological) || ti < len(tasks)) {
		taskSlot := len(items)%taskSlotInterval == taskSlotInterval-1
		if (taskSlot || ci >= len(chronological)) && ti < len(tasks) {
			task := tasks[ti]
			ti++
			items = append(items, FeedItem{Type: "task", Task: &task})
			continue
		}
		if ci < len(chronological) {
			items = append(items, chronological[ci])
			ci++
		}
	}
	return items
}
