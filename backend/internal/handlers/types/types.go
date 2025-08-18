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
	ID             primitive.ObjectID  `bson:"_id" json:"id"`
	Priority       int                 `bson:"priority" json:"priority"`
	Content        string              `bson:"content" json:"content"`
	Value          float64             `bson:"value" json:"value"`
	Recurring      bool                `bson:"recurring" json:"recurring"`
	RecurFrequency string              `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurType      string              `bson:"recurType,omitempty" json:"recurType,omitempty"`
	RecurDetails   *RecurDetails       `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Public         bool                `bson:"public" json:"public"`
	Active         bool                `bson:"active" json:"active"`
	Timestamp      time.Time           `bson:"timestamp" json:"timestamp"`
	LastEdited     time.Time           `bson:"lastEdited" json:"lastEdited"`
	TemplateID     *primitive.ObjectID `bson:"templateID,omitempty" json:"templateID,omitempty"`

	UserID     primitive.ObjectID `bson:"userID,omitempty" json:"userID,omitempty"`
	CategoryID primitive.ObjectID `bson:"categoryID,omitempty" json:"categoryID,omitempty"`

	Deadline  *time.Time `bson:"deadline,omitempty" json:"deadline,omitempty"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	StartDate *time.Time `bson:"startDate" json:"startDate"` // Defaults to today

	Notes     string          `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist []ChecklistItem `bson:"checklist,omitempty" json:"checklist,omitempty"`
	Reminders []*Reminder     `bson:"reminders,omitempty" json:"reminders,omitempty"`
}

/*
Generic to all tasks in the categories collection
*/
type Reminder struct {
	TriggerTime    time.Time `bson:"triggerTime" json:"triggerTime"`
	Type           string    `bson:"type" json:"type"` // relative, absolute
	Sent           bool      `bson:"sent" json:"sent"`
	AfterStart     bool      `bson:"afterStart" json:"afterStart"`
	BeforeStart    bool      `bson:"beforeStart" json:"beforeStart"`
	BeforeDeadline bool      `bson:"beforeDeadline" json:"beforeDeadline"`
	AfterDeadline  bool      `bson:"afterDeadline" json:"afterDeadline"`

	// Enhanced reminder features
	CustomMessage *string `bson:"customMessage,omitempty" json:"customMessage,omitempty"`
	Sound         *string `bson:"sound,omitempty" json:"sound,omitempty"`
	Vibration     bool    `bson:"vibration" json:"vibration"`
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
	Reminders []*Reminder     `bson:"reminders,omitempty" json:"reminders,omitempty"`
}

type RecurDetails struct {
	Every       int          `validate:"required,min=1" bson:"every,omitempty" json:"every,omitempty"`
	DaysOfWeek  []int        `validate:"omitempty,min=7,max=7" bson:"daysOfWeek,omitempty" json:"daysOfWeek,omitempty"`
	DaysOfMonth []int        `validate:"omitempty,min=1,max=31,unique" bson:"daysOfMonth,omitempty" json:"daysOfMonth,omitempty"`
	Months      []int        `validate:"omitempty,min=1,max=12,unique" bson:"months,omitempty" json:"months,omitempty"`
	Behavior    string       `validate:"required,oneof=BUILDUP ROLLING" bson:"behavior,omitempty" json:"behavior,omitempty"` // Buildup, Rolling
	Reminders   []*time.Time `bson:"reminders,omitempty" json:"reminders,omitempty"`
}

type ChecklistItem struct {
	Content   string `bson:"content" json:"content"`
	Completed bool   `bson:"completed" json:"completed"`
	Order     int    `bson:"order" json:"order"`
}

type User struct {
	ID             primitive.ObjectID   `bson:"_id" json:"_id"`
	Email          string               `bson:"email" json:"email"`
	Phone          string               `bson:"phone" json:"phone"`
	Password       string               `bson:"password" json:"password"`
	AppleID        string               `bson:"apple_id,omitempty" json:"apple_id,omitempty"`
	GoogleID       string               `bson:"google_id,omitempty" json:"google_id,omitempty"`
	RefreshToken   string               `bson:"refresh_token" json:"refresh_token"`
	TokenUsed      bool                 `bson:"token_used" json:"token_used"`
	Count          float64              `bson:"count" json:"count"`
	Categories     []CategoryDocument   `bson:"categories" json:"categories"`
	Friends        []primitive.ObjectID `bson:"friends" json:"friends"`
	TasksComplete  float64              `bson:"tasks_complete" json:"tasks_complete"`
	RecentActivity []ActivityDocument   `bson:"recent_activity" json:"recent_activity"`
	PushToken      string               `bson:"push_token" json:"push_token"`

	DisplayName     string `bson:"display_name" json:"display_name"`
	Handle          string `bson:"handle" json:"handle"`
	ProfilePicture  string `bson:"profile_picture" json:"profile_picture"`
	Encouragements  int    `bson:"encouragements" json:"encouragements"`
	Congratulations int    `bson:"congratulations" json:"congratulations"`
	Streak          int    `bson:"streak" json:"streak"`
	StreakEligible  bool   `bson:"streakEligible" json:"streakEligible"`
	Points          int    `bson:"points" json:"points"`
	PostsMade       int    `bson:"posts_made" json:"posts_made"`
}

type SafeUser struct {
	ID              primitive.ObjectID   `bson:"_id" json:"_id"`
	DisplayName     string               `bson:"display_name" json:"display_name"`
	Handle          string               `bson:"handle" json:"handle"`
	ProfilePicture  string               `bson:"profile_picture" json:"profile_picture"`
	Categories      []CategoryDocument   `bson:"categories" json:"categories"`
	Friends         []primitive.ObjectID `bson:"friends" json:"friends"`
	TasksComplete   float64              `bson:"tasks_complete" json:"tasks_complete"`
	RecentActivity  []ActivityDocument   `bson:"recent_activity" json:"recent_activity"`
	Encouragements  int                  `bson:"encouragements" json:"encouragements"`
	Congratulations int                  `bson:"congratulations" json:"congratulations"`
	Streak          int                  `bson:"streak" json:"streak"`
	StreakEligible  bool                 `bson:"streakEligible" json:"streakEligible"`
	Points          int                  `bson:"points" json:"points"`
	PostsMade       int                  `bson:"posts_made" json:"posts_made"`
}
type ActivityDocument struct {
	ID          primitive.ObjectID `bson:"_id" json:"_id"`
	User        primitive.ObjectID `bson:"user" json:"user"`
	Year        int                `bson:"year" json:"year"`
	Month       int                `bson:"month" json:"month"`
	Days        []ActivityDay      `bson:"days" json:"days"`
	TotalCount  int                `bson:"totalCount" json:"totalCount"`
	LastUpdated time.Time          `bson:"lastUpdated" json:"lastUpdated"`
}

type ActivityDay struct {
	Day   int `bson:"day" json:"day"`
	Count int `bson:"count" json:"count"`
	Level int `bson:"level" json:"level"`
}

type UserExtendedReference struct {
	ID             string `bson:"_id" json:"_id" example:"507f1f77bcf86cd799439011" doc:"User ID"`
	DisplayName    string `bson:"display_name" json:"display_name" example:"John Doe" doc:"User display name"`
	Handle         string `bson:"handle" json:"handle" example:"johndoe" doc:"User handle"`
	ProfilePicture string `bson:"profile_picture" json:"profile_picture" example:"https://example.com/avatar.jpg" doc:"Profile picture URL"`
}

// Internal version for MongoDB operations
type UserExtendedReferenceInternal struct {
	ID             primitive.ObjectID `bson:"_id"`
	DisplayName    string             `bson:"display_name"`
	Handle         string             `bson:"handle"`
	ProfilePicture string             `bson:"profile_picture"`
}

// Helper function to convert from internal to API type
func (u *UserExtendedReferenceInternal) ToAPI() *UserExtendedReference {
	return &UserExtendedReference{
		ID:             u.ID.Hex(),
		DisplayName:    u.DisplayName,
		Handle:         u.Handle,
		ProfilePicture: u.ProfilePicture,
	}
}
