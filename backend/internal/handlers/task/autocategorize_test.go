package task

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestCategorizationTextIncludesNotes(t *testing.T) {
	text := categorizationText(TaskDocument{Content: "Email the landlord", Notes: "about the Q3 audit"})

	if text != "Email the landlord\nabout the Q3 audit" {
		t.Fatalf("categorizationText = %q", text)
	}
}

func TestCategorizationTextOmitsBlankNotes(t *testing.T) {
	text := categorizationText(TaskDocument{Content: "Email the landlord", Notes: "   "})

	if text != "Email the landlord" {
		t.Fatalf("categorizationText = %q", text)
	}
}

func TestCategorizationTextCapsLongNotes(t *testing.T) {
	task := TaskDocument{Content: "Write up", Notes: strings.Repeat("a", 500)}

	text := categorizationText(task)
	if len(text) != len("Write up")+1+280 {
		t.Fatalf("notes were not capped: len = %d", len(text))
	}
}

func TestResolveCategorizationTarget(t *testing.T) {
	inbox := primitive.NewObjectID()
	other := primitive.NewObjectID()
	item := PendingCategorization{CategoryID: inbox}
	hex := func(id primitive.ObjectID) *string { s := id.Hex(); return &s }

	t.Run("no suggestion", func(t *testing.T) {
		if _, ok := (&Handler{}).resolveCategorizationTarget(TaskFieldSuggestionLocal{}, item); ok {
			t.Fatal("expected no target when the classifier suggested nothing")
		}
	})

	t.Run("suggests the inbox itself", func(t *testing.T) {
		suggestion := TaskFieldSuggestionLocal{CategoryID: hex(inbox)}
		if _, ok := (&Handler{}).resolveCategorizationTarget(suggestion, item); ok {
			t.Fatal("expected the inbox to be rejected as a target")
		}
	})

	t.Run("malformed id", func(t *testing.T) {
		bad := "not-an-object-id"
		if _, ok := (&Handler{}).resolveCategorizationTarget(TaskFieldSuggestionLocal{CategoryID: &bad}, item); ok {
			t.Fatal("expected a malformed id to be rejected")
		}
	})

	t.Run("real category", func(t *testing.T) {
		target, ok := (&Handler{}).resolveCategorizationTarget(TaskFieldSuggestionLocal{CategoryID: hex(other)}, item)
		if !ok || target != other {
			t.Fatalf("resolveCategorizationTarget = %v, %v; want %v, true", target, ok, other)
		}
	})
}

func TestGeminiConfigured(t *testing.T) {
	type service struct{}

	var nilPointer *service
	cases := []struct {
		name string
		in   any
		want bool
	}{
		{"nil interface", nil, false},
		{"typed nil pointer", nilPointer, false},
		{"real service", &service{}, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := geminiConfigured(tc.in); got != tc.want {
				t.Fatalf("geminiConfigured(%v) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}
