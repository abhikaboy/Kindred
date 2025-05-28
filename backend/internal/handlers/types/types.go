package types

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type RecurMode string

const (
	RecurModeOccurence RecurMode = "occurence"
	RecurModeDeadline  RecurMode = "deadline"
	RecurModeWindow    RecurMode = "window"
)

type CategoryDocument struct {
	ID            primitive.ObjectID `bson:"_id" json:"id"`
	Name          string             `bson:"name" json:"name"`
	WorkspaceName string             `bson:"workspaceName" json:"workspaceName"`
	LastEdited    time.Time          `bson:"lastEdited" json:"lastEdited"`
	Tasks         []TaskDocument     `bson:"tasks" json:"tasks"`
	User          primitive.ObjectID `bson:"user" json:"user"`
}

type WorkspaceResult struct {
	Name       string             `bson:"_id" json:"name"`
	Categories []CategoryDocument `bson:"categories" json:"categories"`
}

type TaskDocument struct {
	ID             primitive.ObjectID `bson:"_id" json:"id"`
	Priority       int                `bson:"priority" json:"priority"`
	Content        string             `bson:"content" json:"content"`
	Value          float64            `bson:"value" json:"value"`
	Recurring      bool               `bson:"recurring" json:"recurring"`
	RecurFrequency string             `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurType      string             `bson:"recurType,omitempty" json:"recurType,omitempty"`
	RecurDetails   *RecurDetails      `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Public         bool               `bson:"public" json:"public"`
	Active         bool               `bson:"active" json:"active"`
	Timestamp      time.Time          `bson:"timestamp" json:"timestamp"`
	LastEdited     time.Time          `bson:"lastEdited" json:"lastEdited"`
	TemplateID     primitive.ObjectID `bson:"templateID,omitempty" json:"templateID,omitempty"`

	Deadline  *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate" json:"startDate"` // Defaults to today

	Notes      string          `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist  []ChecklistItem `bson:"checklist,omitempty" json:"checklist,omitempty"`
	Reminders  []*time.Time    `bson:"reminders,omitempty" json:"reminders,omitempty"`	
}

type TemplateTaskDocument struct {
	ID primitive.ObjectID `bson:"_id" json:"id"`

	CategoryID    primitive.ObjectID `bson:"categoryID" json:"categoryID"`
	Priority      int                `bson:"priority" json:"priority"`
	Content       string             `bson:"content" json:"content"`
	Value         float64            `bson:"value" json:"value"`
	Public        bool               `bson:"public" json:"public"`
	LastEdited    time.Time          `bson:"lastEdited" json:"lastEdited"`
	RecurDetails  *RecurDetails      `bson:"recurDetails" json:"recurDetails"`
	LastGenerated *time.Time         `bson:"lastGenerated" json:"lastGenerated"`
	NextGenerated *time.Time         `bson:"nextGenerated" json:"nextGenerated"`

	RecurFrequency string     `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"` // daily, weekly, monthly, yearly
	RecurType      string     `bson:"recurType" json:"recurType"`                               // Occurence, Deadline, Window
	Deadline       *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime      *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate      *time.Time `bson:"startDate,omitempty" json:"startDate,omitempty"` // Defaults to today

	Notes     string          `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist []ChecklistItem `bson:"checklist,omitempty" json:"checklist,omitempty"`
}

type RecurDetails struct {
	Every       int    `validate:"required,min=1" bson:"every,omitempty" json:"every,omitempty"`
	DaysOfWeek  []int  `validate:"omitempty,min=7,max=7" bson:"daysOfWeek,omitempty" json:"daysOfWeek,omitempty"`
	DaysOfMonth []int  `validate:"omitempty,min=1,max=31,unique" bson:"daysOfMonth,omitempty" json:"daysOfMonth,omitempty"`
	Months      []int  `validate:"omitempty,min=1,max=12,unique" bson:"months,omitempty" json:"months,omitempty"`
	Behavior    string `validate:"required,oneof=BUILDUP ROLLING" bson:"behavior,omitempty" json:"behavior,omitempty"` // Buildup, Rolling
	Reminders   []*time.Time `bson:"reminders,omitempty" json:"reminders,omitempty"`
}

type ChecklistItem struct {
	Content   string `bson:"content" json:"content"`
	Completed bool   `bson:"completed" json:"completed"`
	Order     int    `bson:"order" json:"order"`
}
