package task

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateTaskParams struct {
	Priority     int                    `validate:"required,min=1,max=3" bson:"priority" json:"priority"`
	Content      string                 `validate:"required" bson:"content" json:"content"`
	Value        float64                `validate:"required,min=0,max=10" bson:"value" json:"value"`
	Recurring    bool                   `bson:"recurring" json:"recurring"`
	
	RecurFrequency    string                 `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurDetails *RecurDetails `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Public       bool                   `bson:"public" json:"public"`
	Active       bool                   `bson:"active" json:"active"`

	Deadline *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate,omitempty" json:"startDate,omitempty"` // Defaults to today
}

type SortParams struct {
	SortBy  string `validate:"oneof=priority timestamp difficulty none" bson:"sortBy" json:"sortBy"`
	SortDir int    `validate:"oneof=1 -1" bson:"sortDir" json:"sortDir"`
}

type TaskDocument struct {
	ID           primitive.ObjectID     `bson:"_id" json:"id"`
	Priority     int                    `bson:"priority" json:"priority"`
	Content      string                 `bson:"content" json:"content"`
	Value        float64                `bson:"value" json:"value"`
	Recurring    bool                   `bson:"recurring" json:"recurring"`
	RecurFrequency    string                 `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurType    string                 `bson:"recurType,omitempty" json:"recurType,omitempty"`
	RecurDetails *RecurDetails           `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Public       bool                   `bson:"public" json:"public"`
	Active       bool                   `bson:"active" json:"active"`
	Timestamp    time.Time              `bson:"timestamp" json:"timestamp"`
	LastEdited   time.Time              `bson:"lastEdited" json:"lastEdited"`
	TemplateID    primitive.ObjectID     `bson:"templateID,omitempty" json:"templateID,omitempty"`

	Deadline *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate" json:"startDate"` // Defaults to today
}

type TemplateTaskDocument struct {
	ID           primitive.ObjectID     `bson:"_id" json:"id"`

	CategoryID primitive.ObjectID `bson:"categoryID" json:"categoryID"`
	Priority     int                    `bson:"priority" json:"priority"`
	Content      string                 `bson:"content" json:"content"`
	Value        float64                `bson:"value" json:"value"`
	Public       bool                   `bson:"public" json:"public"`
	LastEdited   time.Time              `bson:"lastEdited" json:"lastEdited"`
	RecurDetails *RecurDetails           `bson:"recurDetails" json:"recurDetails"`
	LastGenerated time.Time              `bson:"lastGenerated" json:"lastGenerated"`
	NextGenerated time.Time              `bson:"nextGenerated" json:"nextGenerated"`
	
	RecurFrequency    string                 `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"` // daily, weekly, monthly, yearly
	RecurType    string                 `bson:"recurType" json:"recurType"` // Occurence, Deadline, Window
	Deadline *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate,omitempty" json:"startDate,omitempty"` // Defaults to today
}

type RecurDetails struct {
	Every int `validate:"required,min=1" bson:"every,omitempty" json:"every,omitempty"`
	DaysOfWeek []int `validate:"required,min=7,max=7" bson:"daysOfWeek,omitempty" json:"daysOfWeek,omitempty"`
	DaysOfMonth []int `validate:"required,min=1,max=31,unique" bson:"daysOfMonth,omitempty" json:"daysOfMonth,omitempty"`
	Months []int `validate:"required,min=1,max=12,unique" bson:"months,omitempty" json:"months,omitempty"`
	Behavior string `validate:"required,oneof=BUILDUP ROLLING" bson:"behavior,omitempty" json:"behavior,omitempty"` // Buildup, Rolling
}



type UpdateTaskDocument struct {
	Priority     int                    `bson:"priority" json:"priority"`
	Content      string                 `bson:"content" json:"content"`
	Value        float64                `bson:"value" json:"value"`
	Recurring    bool                   `bson:"recurring" json:"recurring"`
	RecurDetails *RecurDetails           `bson:"recurDetails" json:"recurDetails"`
	Public       bool                   `bson:"public" json:"public"`
	Active       bool                   `bson:"active" json:"active"`
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
