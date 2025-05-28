package Activity

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateActivityParams struct {
	Field1  string      `validate:"required" json:"field1"`
	Field2  Enumeration `validate:"required" json:"field2"`
	Picture *string     `validate:"required" json:"picture"`
}

type ActivityPoint struct {
	date  time.Time
	value float64
}

type ActivityDocument = types.ActivityDocument	

type UpdateActivityDocument struct {
	Field1  string      `bson:"field1,omitempty" json:"field1,omitempty"`
	Field2  Enumeration `bson:"field2,omitempty" json:"field2,omitempty"`
	Picture *string     `bson:"picture,omitempty" json:"picture,omitempty"`
}

type Enumeration string

const (
	Option1 Enumeration = "Option1"
	Option2 Enumeration = "Option2"
	Option3 Enumeration = "Option3"
)

/*
Activity Service to be used by Activity Handler to interact with the
Database layer of the application
*/

type Service struct {
	Activitys *mongo.Collection
}
