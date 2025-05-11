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
	RecurDetails map[string]interface{} `bson:"recurDetails,omitempty" bsonjson:"recurDetails,omitempty"`
	Public       bool                   `bson:"public" json:"public"`
	Active       bool                   `bson:"active" json:"active"`
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
	RecurDetails map[string]interface{} `bson:"recurDetails" json:"recurDetails"`
	Public       bool                   `bson:"public" json:"public"`
	Active       bool                   `bson:"active" json:"active"`
	Timestamp    time.Time              `bson:"timestamp" json:"timestamp"`
	LastEdited   time.Time              `bson:"lastEdited" json:"lastEdited"`
}

type TemplateTaskDocument struct {
	ID           primitive.ObjectID     `bson:"_id" json:"id"`
	Priority     int                    `bson:"priority" json:"priority"`
	Content      string                 `bson:"content" json:"content"`
	Value        float64                `bson:"value" json:"value"`
	Public       bool                   `bson:"public" json:"public"`
	LastEdited   time.Time              `bson:"lastEdited" json:"lastEdited"`
	RecurType    string                 `bson:"recurType" json:"recurType"`
	WeeklyRecur  *WeeklyRecurDetails     `bson:"weeklyRecur,omitempty" json:"weeklyRecur,omitempty"`
	MonthlyRecur *MonthlyRecurDetails    `bson:"monthlyRecur,omitempty" json:"monthlyRecur,omitempty"`
	YearlyRecur  *YearlyRecurDetails     `bson:"yearlyRecur,omitempty" json:"yearlyRecur,omitempty"`
	DailyRecur   *DailyRecurDetails      `bson:"dailyRecur,omitempty" json:"dailyRecur,omitempty"`
	LastGenerated time.Time              `bson:"lastGenerated" json:"lastGenerated"`
	NextGenerated time.Time              `bson:"nextGenerated" json:"nextGenerated"`
}

type WeeklyRecurDetails struct {
	DaysOfWeek []int `bson:"days" json:"days"`
	Every      int   `bson:"every" json:"every"`
}

type MonthlyRecurDetails struct {
	DaysOfMonth []int `bson:"days" json:"days"`
	Every      int   `bson:"every" json:"every"`
}

type YearlyRecurDetails struct {
	Months []int `bson:"months" json:"months"`
	Every  int   `bson:"every" json:"every"`
}

type DailyRecurDetails struct {
	Every int `bson:"every" json:"every"`
}

type UpdateTaskDocument struct {
	Priority     int                    `bson:"priority" json:"priority"`
	Content      string                 `bson:"content" json:"content"`
	Value        float64                `bson:"value" json:"value"`
	Recurring    bool                   `bson:"recurring" json:"recurring"`
	RecurDetails map[string]interface{} `bson:"recurDetails" json:"recurDetails"`
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
}
