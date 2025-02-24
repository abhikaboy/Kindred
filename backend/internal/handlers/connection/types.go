package Connection

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type UserExtendedReference struct {
	ID      primitive.ObjectID `bson:"_id" json:"id"`
	Picture *string            `bson:"picture" json:"picture"`
	Name    string             `bson:"name" json:"name"`
	Handle  string             `bson:"handle" json:"handle"`
}

type CreateConnectionParams struct {
	Requester UserExtendedReference `validate:"required" json:"requester"`
	Reciever  string                `validate:"required" json:"reciever"`
}

type ConnectionDocument struct {
	ID        primitive.ObjectID    `bson:"_id" json:"id"`
	Requester UserExtendedReference `validate:"required" json:"requester"`
	Reciever  string                `validate:"required" json:"reciever"`
	Timestamp time.Time             `bson:"timestamp" json:"timestamp"`
}

type UpdateConnectionDocument struct {
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
Connection Service to be used by Connection Handler to interact with the
Database layer of the application
*/

type Service struct {
	Connections *mongo.Collection
}
