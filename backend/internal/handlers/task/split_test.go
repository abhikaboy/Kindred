package task

import (
	"reflect"
	"testing"
)

func TestCleanSplitTasks(t *testing.T) {
	got := CleanSplitTasks([]string{"  email the landlord ", "", "   ", "pay rent by friday"})
	want := []string{"email the landlord", "pay rent by friday"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("CleanSplitTasks() = %q, want %q", got, want)
	}
}

func TestCleanSplitTasksCapsCount(t *testing.T) {
	in := []string{"a", "b", "c", "d", "e", "f", "g", "h"}
	if got := CleanSplitTasks(in); len(got) != maxSplitTasks {
		t.Fatalf("len = %d, want %d", len(got), maxSplitTasks)
	}
}
