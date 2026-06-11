package Post

import (
	"math/rand"
	"testing"
	"time"
)

// makeCandidates builds candidates with distinct IDs; hot ones get an
// imminent start + high priority so they score far above the rest.
func makeCandidates(hot, cold int) []taskCandidate {
	out := make([]taskCandidate, 0, hot+cold)
	for i := 0; i < hot; i++ {
		c := baselineCandidate()
		c.feedTask.ID = "hot-" + string(rune('a'+i))
		c.feedTask.Priority = 3
		c.startTime = timePtr(testNow.Add(30 * time.Minute))
		out = append(out, c)
	}
	for i := 0; i < cold; i++ {
		c := baselineCandidate()
		c.feedTask.ID = "cold-" + string(rune('a'+i))
		c.createdAt = testNow.Add(-30 * 24 * time.Hour) // old → near-zero score
		out = append(out, c)
	}
	return out
}

func TestSampleTasks_NoDuplicates(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	candidates := makeCandidates(3, 7)
	picked := sampleTasks(candidates, 5, defaultTaskScoring, testNow, rng)
	if len(picked) != 5 {
		t.Fatalf("expected 5 picks, got %d", len(picked))
	}
	seen := map[string]bool{}
	for _, p := range picked {
		if seen[p.ID] {
			t.Fatalf("duplicate task sampled: %s", p.ID)
		}
		seen[p.ID] = true
	}
}

func TestSampleTasks_FavorsHighScorers(t *testing.T) {
	// Over many seeds, the first pick should overwhelmingly be a hot task.
	hotFirst := 0
	const runs = 500
	for seed := 0; seed < runs; seed++ {
		rng := rand.New(rand.NewSource(int64(seed)))
		candidates := makeCandidates(2, 8)
		picked := sampleTasks(candidates, 1, defaultTaskScoring, testNow, rng)
		if len(picked) == 1 && picked[0].ID[:3] == "hot" {
			hotFirst++
		}
	}
	// 2 hot tasks score ~5.5 vs ~0.001 for cold; weighted (score+0.15)²
	// sampling should pick hot first in the vast majority of runs.
	if hotFirst < runs*8/10 {
		t.Fatalf("hot tasks picked first only %d/%d runs", hotFirst, runs)
	}
}

func TestSampleTasks_NMoreThanCandidates_ReturnsAllBestFirst(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	candidates := makeCandidates(1, 2)
	picked := sampleTasks(candidates, 10, defaultTaskScoring, testNow, rng)
	if len(picked) != 3 {
		t.Fatalf("expected all 3 candidates, got %d", len(picked))
	}
	if picked[0].ID[:3] != "hot" {
		t.Fatalf("expected highest scorer first, got %s", picked[0].ID)
	}
}

func TestSampleTasks_EmptyAndZero(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	if got := sampleTasks(nil, 3, defaultTaskScoring, testNow, rng); len(got) != 0 {
		t.Fatal("nil candidates should return empty")
	}
	if got := sampleTasks(makeCandidates(1, 1), 0, defaultTaskScoring, testNow, rng); len(got) != 0 {
		t.Fatal("n=0 should return empty")
	}
}
