package gemini

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
)

// Live smoke tests against the real Gemini API. Opt-in: GEMINI_LIVE=1 make test-gemini-live.
// They spend real tokens and need MongoDB for the seeded fixture user.

func liveService(t *testing.T) (*GeminiService, string) {
	t.Helper()
	if os.Getenv("GEMINI_LIVE") != "1" {
		t.Skip("set GEMINI_LIVE=1 to run live Gemini tests")
	}
	// .env carries the real MONGO_URI; keep fixtures on local Docker Mongo unless told otherwise
	if os.Getenv("TEST_MONGO_URI") == "" {
		t.Setenv("TEST_MONGO_URI", "mongodb://localhost:27017/?directConnection=true")
	}
	_ = godotenv.Load("../../.env")
	if os.Getenv("GEMINI_API_KEY") == "" && os.Getenv("GOOGLE_API_KEY") == "" {
		t.Skip("GEMINI_API_KEY not set")
	}

	testDB, _, err := testpkg.SetupTestEnvironment()
	if err != nil {
		t.Skipf("skipping: MongoDB not available: %v", err)
	}
	t.Cleanup(func() { _ = testpkg.TeardownTestEnvironment(testDB) })
	collections := testDB.GetCollections()

	var raw bson.M
	if err := collections["users"].FindOne(context.Background(), bson.M{}).Decode(&raw); err != nil {
		t.Fatalf("no fixture user: %v", err)
	}
	id, ok := raw["_id"].(interface{ Hex() string })
	if !ok {
		t.Fatalf("fixture user has no ObjectID")
	}
	return InitGenkit(collections, nil), id.Hex()
}

func TestLiveMultiTaskFromText(t *testing.T) {
	svc, _ := liveService(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	out, err := svc.MultiTaskFromTextFlow.Run(ctx, MultiTaskFromTextInput{Text: "buy groceries and call mom tomorrow"})
	if err != nil {
		t.Fatalf("flow failed: %v", err)
	}
	assertHasTasks(t, out)
}

func TestLiveMultiTaskFromTextWithContext(t *testing.T) {
	svc, userID := liveService(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	out, err := svc.MultiTaskFromTextFlowWithContext.Run(ctx, MultiTaskFromTextInputWithUser{
		UserID:   userID,
		Text:     "finish the report by friday and go for a run",
		Timezone: "America/New_York",
	})
	if err != nil {
		t.Fatalf("flow failed: %v", err)
	}
	assertHasTasks(t, out)
}

func assertHasTasks(t *testing.T, out MultiTaskFromTextOutput) {
	t.Helper()
	var names []string
	for _, p := range out.Tasks {
		names = append(names, p.Task.Content)
	}
	for _, c := range out.Categories {
		for _, task := range c.Tasks {
			names = append(names, task.Content)
		}
	}
	if len(names) == 0 {
		t.Fatalf("expected at least one task, got %+v", out)
	}
	for _, n := range names {
		if strings.TrimSpace(n) == "" {
			t.Errorf("task with empty content in %+v", out)
		}
	}
	t.Logf("generated tasks: %v", names)
}
