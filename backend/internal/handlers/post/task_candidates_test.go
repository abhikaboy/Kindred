package Post

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func validTaskDoc() bson.M {
	return bson.M{
		"_id":           primitive.NewObjectID(),
		"content":       "Morning workout",
		"priority":      int32(2),
		"value":         7.5,
		"public":        true,
		"timestamp":     primitive.NewDateTimeFromTime(testNow.Add(-1 * time.Hour)),
		"categoryId":    primitive.NewObjectID(),
		"categoryName":  "Fitness",
		"workspaceName": "Personal",
		"user": bson.M{
			"_id":             primitive.NewObjectID(),
			"handle":          "@sam",
			"display_name":    "Sam",
			"profile_picture": "https://cdn/p.jpg",
		},
	}
}

func TestParseTaskCandidate_FullDoc(t *testing.T) {
	doc := validTaskDoc()
	doc["deadline"] = primitive.NewDateTimeFromTime(testNow.Add(24 * time.Hour))
	doc["startTime"] = primitive.NewDateTimeFromTime(testNow.Add(2 * time.Hour))
	doc["startDate"] = primitive.NewDateTimeFromTime(testNow)
	doc["workingOnSince"] = primitive.NewDateTimeFromTime(testNow.Add(-5 * time.Minute))

	c, ok := parseTaskCandidate(doc)
	if !ok {
		t.Fatal("expected parse to succeed")
	}
	if c.feedTask.Content != "Morning workout" || c.feedTask.Priority != 2 || c.feedTask.Value != 7.5 {
		t.Fatalf("wire fields wrong: %+v", c.feedTask)
	}
	if c.feedTask.User == nil || c.feedTask.User.Handle != "@sam" {
		t.Fatalf("user not parsed: %+v", c.feedTask.User)
	}
	if c.deadline == nil || c.startTime == nil || c.startDate == nil || c.workingOnSince == nil {
		t.Fatal("scoring time fields not parsed")
	}
	if !c.deadline.Equal(testNow.Add(24 * time.Hour)) {
		t.Fatalf("deadline wrong: %v", c.deadline)
	}
}

func TestParseTaskCandidate_OptionalFieldsAbsent(t *testing.T) {
	c, ok := parseTaskCandidate(validTaskDoc())
	if !ok {
		t.Fatal("expected parse to succeed without optional fields")
	}
	if c.deadline != nil || c.startTime != nil || c.startDate != nil || c.workingOnSince != nil {
		t.Fatal("absent optional fields must parse as nil")
	}
	if c.feedTask.User == nil {
		t.Fatal("user should be parsed")
	}
}

func TestParseTaskCandidate_MissingRequiredField(t *testing.T) {
	doc := validTaskDoc()
	delete(doc, "content")
	if _, ok := parseTaskCandidate(doc); ok {
		t.Fatal("expected parse to fail when content missing")
	}
}
