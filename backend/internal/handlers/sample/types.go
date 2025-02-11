package sample

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateSampleParams struct {
	Field1   string      `validate:"required" json:"field1"`
	Field2   Enumeration `validate:"required" json:"field2"`
	Location *[]float64  `validate:"required" json:"location"`
	Picture  *string     `validate:"required" json:"picture"`
}

type SampleDocument struct {
	ID        primitive.ObjectID `bson:"_id" json:"id"`
	Field1    string             `bson:"field1" json:"field1"`
	Field2    Enumeration        `bson:"field2" json:"field2"`
	Location  *[]float64         `bson:"location" json:"location"`
	Picture   *string            `bson:"picture" json:"picture"`
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
}

type UpdateSampleDocument struct {
	Field1   string      `bson:"field1,omitempty" json:"field1,omitempty"`
	Field2   Enumeration `bson:"field2,omitempty" json:"field2,omitempty"`
	Location *[]float64  `bson:"location,omitempty" json:"location,omitempty"`
	Picture  *string     `bson:"picture,omitempty" json:"picture,omitempty"`
}

type Enumeration string

const (
	Option1 Enumeration = "Option1"
	Option2 Enumeration = "Option2"
	Option3 Enumeration = "Option3"
)

type GetNearbySamplesParams struct {
	Location []float64 `validate:"required" json:"location"`
	Radius   float64   `validate:"required" json:"radius"`
}

/*
Sample Service to be used by Sample Handler to interact with the
Database layer of the application
*/

type Service struct {
	Samples *mongo.Collection
}
