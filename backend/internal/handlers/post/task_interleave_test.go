package Post

import (
	"testing"
)

func makePosts(n int) []FeedItem {
	items := make([]FeedItem, n)
	for i := range items {
		items[i] = FeedItem{Type: "post"}
	}
	return items
}

func makeFeedTasks(n int) []FeedTaskData {
	tasks := make([]FeedTaskData, n)
	for i := range tasks {
		tasks[i] = FeedTaskData{ID: "task-" + string(rune('a'+i))}
	}
	return tasks
}

func TestInterleave_TasksAtReservedSlots(t *testing.T) {
	items := interleaveFeedItems(makePosts(20), makeFeedTasks(3), 20)
	if len(items) != 20 {
		t.Fatalf("expected 20 items, got %d", len(items))
	}
	for i, item := range items {
		isTaskSlot := i%taskSlotInterval == taskSlotInterval-1 // positions 5, 11, 17
		if isTaskSlot && item.Type != "task" {
			t.Fatalf("position %d should be a task, got %s", i, item.Type)
		}
		if !isTaskSlot && item.Type != "post" {
			t.Fatalf("position %d should be a post, got %s", i, item.Type)
		}
	}
	// Sampled order preserved: best draw in the first slot.
	if items[5].Task.ID != "task-a" || items[11].Task.ID != "task-b" || items[17].Task.ID != "task-c" {
		t.Fatal("tasks should fill slots in sampled order")
	}
}

func TestInterleave_NoTasks_AllPosts(t *testing.T) {
	items := interleaveFeedItems(makePosts(10), nil, 20)
	if len(items) != 10 {
		t.Fatalf("expected 10 items, got %d", len(items))
	}
	for i, item := range items {
		if item.Type != "post" {
			t.Fatalf("position %d should be a post, got %s", i, item.Type)
		}
	}
}

func TestInterleave_PostsExhausted_TasksFillTail(t *testing.T) {
	items := interleaveFeedItems(makePosts(2), makeFeedTasks(4), 20)
	if len(items) != 6 {
		t.Fatalf("expected 6 items (2 posts + 4 tasks), got %d", len(items))
	}
	// First two slots are posts (slot 5 never reached before posts run out),
	// remaining are tasks.
	if items[0].Type != "post" || items[1].Type != "post" {
		t.Fatal("first two items should be posts")
	}
	for i := 2; i < 6; i++ {
		if items[i].Type != "task" {
			t.Fatalf("position %d should be a task, got %s", i, items[i].Type)
		}
	}
}

func TestInterleave_RespectsLimit(t *testing.T) {
	items := interleaveFeedItems(makePosts(50), makeFeedTasks(10), 12)
	if len(items) != 12 {
		t.Fatalf("expected 12 items, got %d", len(items))
	}
}

func TestInterleave_Empty(t *testing.T) {
	if items := interleaveFeedItems(nil, nil, 20); len(items) != 0 {
		t.Fatal("empty inputs should produce empty feed")
	}
}
