package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	vegeta "github.com/tsenart/vegeta/v12/lib"
)

func printReport(name string, metrics *vegeta.Metrics) {
	metrics.Close()

	sep := strings.Repeat("━", 72)

	fmt.Printf("\n%s\n", sep)
	fmt.Printf("  LOAD TEST RESULTS: %s\n", strings.ToUpper(name))
	fmt.Printf("%s\n\n", sep)

	fmt.Printf("  %-24s %d\n", "Total Requests:", metrics.Requests)
	fmt.Printf("  %-24s %.2f req/s\n", "Throughput:", metrics.Throughput)
	fmt.Printf("  %-24s %.2f req/s\n", "Target Rate:", metrics.Rate)
	fmt.Printf("  %-24s %s\n", "Duration:", metrics.Duration.Round(time.Millisecond))
	fmt.Printf("  %-24s %d bytes\n", "Total Bytes In:", metrics.BytesIn.Total)
	fmt.Printf("  %-24s %d bytes\n", "Total Bytes Out:", metrics.BytesOut.Total)

	fmt.Printf("\n  LATENCY\n")
	fmt.Printf("  %-24s %s\n", "Mean:", metrics.Latencies.Mean.Round(time.Microsecond))
	fmt.Printf("  %-24s %s\n", "P50:", metrics.Latencies.P50.Round(time.Microsecond))
	fmt.Printf("  %-24s %s\n", "P90:", metrics.Latencies.P90.Round(time.Microsecond))
	fmt.Printf("  %-24s %s\n", "P95:", metrics.Latencies.P95.Round(time.Microsecond))
	fmt.Printf("  %-24s %s\n", "P99:", metrics.Latencies.P99.Round(time.Microsecond))
	fmt.Printf("  %-24s %s\n", "Max:", metrics.Latencies.Max.Round(time.Microsecond))

	successRate := metrics.Success * 100
	fmt.Printf("\n  SUCCESS & ERRORS\n")
	fmt.Printf("  %-24s %.2f%%\n", "Success Rate:", successRate)

	if len(metrics.StatusCodes) > 0 {
		fmt.Printf("\n  STATUS CODES\n")
		codes := make([]string, 0, len(metrics.StatusCodes))
		for code := range metrics.StatusCodes {
			codes = append(codes, code)
		}
		sort.Strings(codes)
		for _, code := range codes {
			count := metrics.StatusCodes[code]
			pct := float64(count) / float64(metrics.Requests) * 100
			fmt.Printf("    %-6s %d (%.1f%%)\n", code, count, pct)
		}
	}

	if len(metrics.Errors) > 0 {
		fmt.Printf("\n  ERRORS (top 5)\n")
		limit := 5
		if len(metrics.Errors) < limit {
			limit = len(metrics.Errors)
		}
		for i := range limit {
			msg := metrics.Errors[i]
			if len(msg) > 120 {
				msg = msg[:120] + "..."
			}
			fmt.Printf("    %s\n", msg)
		}
	}

	fmt.Printf("\n%s\n", sep)
}

func writeJSONResults(filename string, results []vegeta.Result) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("create %s: %w", filename, err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	for _, r := range results {
		if err := enc.Encode(r); err != nil {
			return fmt.Errorf("encode result: %w", err)
		}
	}
	return nil
}
