package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	vegeta "github.com/tsenart/vegeta/v12/lib"
)

func main() {
	rate := flag.Int("rate", 50, "requests per second")
	duration := flag.Duration("duration", 30*time.Second, "test duration")
	scenario := flag.String("scenario", "all", "scenario to run: health, tasks, posts, profiles, categories, mixed, all")
	port := flag.Int("port", 0, "port to listen on (0 = random)")
	output := flag.String("output", "", "write JSON results to file")
	flag.Parse()

	ctx := context.Background()

	fmt.Println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("  KINDRED LOAD TEST")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("  Rate: %d req/s | Duration: %s | Scenario: %s\n\n", *rate, *duration, *scenario)

	fmt.Println("[1/4] Setting up environment...")
	env, err := Setup(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Setup failed: %v\n", err)
		os.Exit(1)
	}
	defer env.Teardown(ctx)

	fmt.Println("\n[2/4] Starting server...")
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Listen failed: %v\n", err)
		os.Exit(1)
	}
	tcpAddr, ok := ln.Addr().(*net.TCPAddr)
	if !ok {
		fmt.Fprintf(os.Stderr, "Failed to get TCP address from listener\n")
		os.Exit(1)
	}
	actualPort := tcpAddr.Port
	fmt.Printf("  Listening on :%d\n", actualPort)

	go func() {
		if err := env.App.Listener(ln); err != nil {
			fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		}
	}()
	defer func() {
		_ = env.App.Shutdown()
	}()

	// Give the server a moment to start
	time.Sleep(200 * time.Millisecond)

	baseURL := fmt.Sprintf("http://localhost:%d", actualPort)

	fmt.Println("\n[3/4] Running load tests...")
	scenarios := BuildScenarios(env)

	var toRun []Scenario
	if *scenario == "all" {
		for _, name := range []string{"health", "tasks", "posts", "profiles", "categories", "mixed"} {
			toRun = append(toRun, scenarios[name])
		}
	} else {
		names := strings.Split(*scenario, ",")
		for _, name := range names {
			name = strings.TrimSpace(name)
			sc, ok := scenarios[name]
			if !ok {
				fmt.Fprintf(os.Stderr, "Unknown scenario: %s\nAvailable: health, tasks, posts, profiles, categories, mixed, all\n", name)
				os.Exit(1)
			}
			toRun = append(toRun, sc)
		}
	}

	fmt.Printf("\n[4/4] Results\n\n")

	for _, sc := range toRun {
		targeter := prefixTargeter(baseURL, sc.Targeter)
		attacker := vegeta.NewAttacker()

		var metrics vegeta.Metrics
		var allResults []vegeta.Result

		pacer := vegeta.ConstantPacer{Freq: *rate, Per: time.Second}

		for res := range attacker.Attack(targeter, pacer, *duration, sc.Name) {
			metrics.Add(res)
			if *output != "" {
				allResults = append(allResults, *res)
			}
		}

		printReport(sc.Name, &metrics)

		if *output != "" {
			fname := fmt.Sprintf("%s_%s.json", *output, sc.Name)
			if err := writeJSONResults(fname, allResults); err != nil {
				fmt.Fprintf(os.Stderr, "Warning: could not write results to %s: %v\n", fname, err)
			} else {
				fmt.Printf("  Results written to %s\n", fname)
			}
		}
	}
}

func prefixTargeter(baseURL string, inner vegeta.Targeter) vegeta.Targeter {
	return func(tgt *vegeta.Target) error {
		if err := inner(tgt); err != nil {
			return err
		}
		tgt.URL = baseURL + tgt.URL
		return nil
	}
}
