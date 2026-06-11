package Post

import (
	"math"
	"math/rand"
	"sort"
	"time"
)

// sampleTasks picks n tasks by weighted sampling without replacement,
// probability ∝ (score + ε)^exponent — high scorers dominate but any task
// stays possible, so refreshes rotate. Returns picks in draw order.
func sampleTasks(candidates []taskCandidate, n int, cfg taskScoringConfig, now time.Time, rng *rand.Rand) []FeedTaskData {
	if n <= 0 || len(candidates) == 0 {
		return nil
	}

	type scored struct {
		idx    int
		score  float64
		weight float64
	}
	pool := make([]scored, len(candidates))
	for i := range candidates {
		s := scoreTask(&candidates[i], cfg, now)
		pool[i] = scored{
			idx:    i,
			score:  s,
			weight: math.Pow(s+cfg.SamplingEpsilon, cfg.SamplingExponent),
		}
	}

	// Fewer candidates than asked: return everything, best first.
	if n >= len(candidates) {
		sort.SliceStable(pool, func(a, b int) bool { return pool[a].score > pool[b].score })
		out := make([]FeedTaskData, len(pool))
		for i, p := range pool {
			out[i] = candidates[p.idx].feedTask
		}
		return out
	}

	out := make([]FeedTaskData, 0, n)
	for len(out) < n {
		total := 0.0
		for _, p := range pool {
			total += p.weight
		}
		r := rng.Float64() * total
		pick := len(pool) - 1
		acc := 0.0
		for i, p := range pool {
			acc += p.weight
			if r < acc {
				pick = i
				break
			}
		}
		out = append(out, candidates[pool[pick].idx].feedTask)
		pool = append(pool[:pick], pool[pick+1:]...)
	}
	return out
}
