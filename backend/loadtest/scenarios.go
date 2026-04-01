package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"

	vegeta "github.com/tsenart/vegeta/v12/lib"
)

type Scenario struct {
	Name     string
	Targeter vegeta.Targeter
}

func BuildScenarios(env *LoadTestEnv) map[string]Scenario {
	return map[string]Scenario{
		"health":     healthScenario(),
		"tasks":      tasksScenario(env),
		"posts":      postsScenario(env),
		"profiles":   profilesScenario(env),
		"categories": categoriesScenario(env),
		"mixed":      mixedScenario(env),
	}
}

func healthScenario() Scenario {
	targets := []vegeta.Target{
		{Method: "GET", URL: "/v1/health"},
		{Method: "GET", URL: "/welcome"},
	}
	return Scenario{
		Name:     "health",
		Targeter: roundRobinTargeter(targets),
	}
}

func tasksScenario(env *LoadTestEnv) Scenario {
	var targets []vegeta.Target

	for _, u := range env.Fixtures.Users {
		uid := u.ID.Hex()
		tok := env.AuthTokens[uid]
		header := http.Header{"Authorization": []string{"Bearer " + tok}}

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    "/v1/user/tasks/",
			Header: header,
		})

		for _, cat := range env.Fixtures.Categories {
			if cat.User != u.ID {
				continue
			}
			body, _ := json.Marshal(map[string]interface{}{
				"priority": 2,
				"content":  fmt.Sprintf("Load test task %d", rand.Intn(10000)),
				"value":    3.0,
			})
			targets = append(targets, vegeta.Target{
				Method: "POST",
				URL:    fmt.Sprintf("/v1/user/tasks/%s", cat.ID.Hex()),
				Header: withJSON(header),
				Body:   body,
			})

			if len(cat.Tasks) > 0 {
				t := cat.Tasks[0]
				patchBody, _ := json.Marshal(map[string]interface{}{
					"priority": 1,
					"content":  t.Content + " (updated)",
					"value":    t.Value,
				})
				targets = append(targets, vegeta.Target{
					Method: "PATCH",
					URL:    fmt.Sprintf("/v1/user/tasks/%s/%s", cat.ID.Hex(), t.ID.Hex()),
					Header: withJSON(header),
					Body:   patchBody,
				})
			}
			break // one category per user is enough
		}
	}

	return Scenario{
		Name:     "tasks",
		Targeter: randomTargeter(targets),
	}
}

func postsScenario(env *LoadTestEnv) Scenario {
	var targets []vegeta.Target

	for _, u := range env.Fixtures.Users {
		uid := u.ID.Hex()
		tok := env.AuthTokens[uid]
		header := http.Header{"Authorization": []string{"Bearer " + tok}}

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    "/v1/user/posts",
			Header: header,
		})

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    "/v1/user/posts/friends",
			Header: header,
		})
	}

	return Scenario{
		Name:     "posts",
		Targeter: randomTargeter(targets),
	}
}

func profilesScenario(env *LoadTestEnv) Scenario {
	var targets []vegeta.Target

	for _, u := range env.Fixtures.Users {
		uid := u.ID.Hex()
		tok := env.AuthTokens[uid]
		header := http.Header{"Authorization": []string{"Bearer " + tok}}

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    fmt.Sprintf("/v1/user/profiles/%s", uid),
			Header: header,
		})
	}

	return Scenario{
		Name:     "profiles",
		Targeter: randomTargeter(targets),
	}
}

func categoriesScenario(env *LoadTestEnv) Scenario {
	var targets []vegeta.Target

	for _, u := range env.Fixtures.Users {
		uid := u.ID.Hex()
		tok := env.AuthTokens[uid]
		header := http.Header{"Authorization": []string{"Bearer " + tok}}

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    fmt.Sprintf("/v1/user/categories/%s", uid),
			Header: header,
		})

		targets = append(targets, vegeta.Target{
			Method: "GET",
			URL:    "/v1/user/workspaces",
			Header: header,
		})
	}

	return Scenario{
		Name:     "categories",
		Targeter: randomTargeter(targets),
	}
}

func mixedScenario(env *LoadTestEnv) Scenario {
	scenarios := []struct {
		weight int
		build  func(*LoadTestEnv) Scenario
	}{
		{40, func(e *LoadTestEnv) Scenario { return tasksScenario(e) }},
		{25, func(e *LoadTestEnv) Scenario { return postsScenario(e) }},
		{15, func(e *LoadTestEnv) Scenario { return categoriesScenario(e) }},
		{10, func(e *LoadTestEnv) Scenario { return profilesScenario(e) }},
		{10, func(_ *LoadTestEnv) Scenario { return healthScenario() }},
	}

	type weightedTargeter struct {
		weight   int
		targeter vegeta.Targeter
	}

	var weighted []weightedTargeter
	totalWeight := 0
	for _, s := range scenarios {
		sc := s.build(env)
		weighted = append(weighted, weightedTargeter{weight: s.weight, targeter: sc.Targeter})
		totalWeight += s.weight
	}

	return Scenario{
		Name: "mixed",
		Targeter: func(tgt *vegeta.Target) error {
			r := rand.Intn(totalWeight)
			cumulative := 0
			for _, w := range weighted {
				cumulative += w.weight
				if r < cumulative {
					return w.targeter(tgt)
				}
			}
			return weighted[len(weighted)-1].targeter(tgt)
		},
	}
}

func roundRobinTargeter(targets []vegeta.Target) vegeta.Targeter {
	i := 0
	return func(tgt *vegeta.Target) error {
		*tgt = targets[i%len(targets)]
		i++
		return nil
	}
}

func randomTargeter(targets []vegeta.Target) vegeta.Targeter {
	return func(tgt *vegeta.Target) error {
		*tgt = targets[rand.Intn(len(targets))]
		return nil
	}
}

func withJSON(h http.Header) http.Header {
	out := h.Clone()
	out.Set("Content-Type", "application/json")
	return out
}
