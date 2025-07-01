package task

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateTaskParams struct {
	Priority  int     `validate:"required,min=1,max=3" bson:"priority" json:"priority"`
	Content   string  `validate:"required" bson:"content" json:"content"`
	Value     float64 `validate:"required,min=0,max=10" bson:"value" json:"value"`
	Recurring bool    `bson:"recurring" json:"recurring"`

	RecurFrequency string        `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurDetails   *RecurDetails `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Public         bool          `bson:"public" json:"public"`
	Active         bool          `bson:"active" json:"active"`

	Deadline  *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate,omitempty" json:"startDate,omitempty"` // Defaults to today

	Notes     string          `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist []ChecklistItem `bson:"checklist,omitempty" json:"checklist,omitempty"`
	Reminders []*Reminder     `bson:"reminders,omitempty" json:"reminders,omitempty"`
}

type SortParams struct {
	SortBy  string `validate:"oneof=priority timestamp difficulty none" bson:"sortBy" json:"sortBy"`
	SortDir int    `validate:"oneof=1 -1" bson:"sortDir" json:"sortDir"`
}

type TaskDocument = types.TaskDocument
type RecurDetails = types.RecurDetails
type TemplateTaskDocument = types.TemplateTaskDocument
type ChecklistItem = types.ChecklistItem
type Reminder = types.Reminder

type UpdateTaskDocument struct {
	Priority     int           `bson:"priority" json:"priority"`
	Content      string        `bson:"content" json:"content"`
	Value        float64       `bson:"value" json:"value"`
	Recurring    bool          `bson:"recurring" json:"recurring"`
	RecurDetails *RecurDetails `bson:"recurDetails" json:"recurDetails"`
	Public       bool          `bson:"public" json:"public"`
	Active       bool          `bson:"active" json:"active"`

	Notes     string          `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist []ChecklistItem `bson:"checklist,omitempty" json:"checklist,omitempty"`
}

type SortTypes string
type SortDirection int

const (
	Priority   SortTypes = "priority"
	Time       SortTypes = "timestamp"
	Difficulty SortTypes = "value"

	Ascending  SortDirection = 1
	Descending SortDirection = -1
)

type CompleteTaskDocument struct {
	TimeCompleted string `bson:"timeCompleted" json:"timeCompleted"`
	TimeTaken     string `bson:"timeTaken" json:"timeTaken"`
}

type UpdateTaskNotesDocument struct {
	Notes string `bson:"notes" json:"notes"`
}

type UpdateTaskChecklistDocument struct {
	Checklist []ChecklistItem `bson:"checklist" json:"checklist"`
}

/*
Task Service to be used by Task Handler to interact with the
Database layer of the application
*/

type Service struct {
	Users          *mongo.Collection
	Tasks          *mongo.Collection
	CompletedTasks *mongo.Collection
	TemplateTasks  *mongo.Collection
}

type TaskID struct {
	TaskID     primitive.ObjectID
	CategoryID primitive.ObjectID
	UserID     primitive.ObjectID
}
