package friendship

import "testing"

func TestLevelFor(t *testing.T) {
	tests := []struct {
		name  string
		score int
		want  int
	}{
		{"negative clamps to level 1", -5, 1},
		{"zero", 0, 1},
		{"below level 2", 24, 1},
		{"level 2 floor", 25, 2},
		{"below level 3", 74, 2},
		{"level 3 floor", 75, 3},
		{"level 4 floor", 150, 4},
		{"below level 5", 299, 4},
		{"level 5 floor", 300, 5},
		{"level 5 is max", 100000, 5},
	}
	for _, tt := range tests {
		if got := LevelFor(tt.score); got != tt.want {
			t.Errorf("%s: LevelFor(%d) = %d, want %d", tt.name, tt.score, got, tt.want)
		}
	}
}

// Mirrors the LeveledUp computation in Bump without touching mongo.
func TestLeveledUpBoundary(t *testing.T) {
	tests := []struct {
		name     string
		newScore int
		delta    int
		want     bool
	}{
		{"kudos lands exactly on the level 2 floor", 25, PointsKudos, true},
		{"kudos jumps past the level 2 floor", 26, PointsKudos, true},
		{"comment stays inside level 1", 24, PointsComment, false},
		{"reaction lands on the level 3 floor", 75, PointsReaction, true},
		{"reaction one short of the level 3 floor", 74, PointsReaction, false},
		{"already past the floor", 30, PointsKudos, false},
		{"first point ever", 1, PointsReaction, false},
	}
	for _, tt := range tests {
		got := LevelFor(tt.newScore) > LevelFor(tt.newScore-tt.delta)
		if got != tt.want {
			t.Errorf("%s: leveledUp(score=%d, delta=%d) = %v, want %v", tt.name, tt.newScore, tt.delta, got, tt.want)
		}
	}
}
