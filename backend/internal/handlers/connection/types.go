package Connection

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type UserExtendedReference struct {
	ID      primitive.ObjectID `bson:"_id" json:"_id"`
	Picture *string            `bson:"picture" json:"picture"`
	Name    string             `bson:"name" json:"name"`
	Handle  string             `bson:"handle" json:"handle"`
}

type CreateConnectionParams struct {
	Requester UserExtendedReference `validate:"required" json:"requester"`
	Reciever  primitive.ObjectID    `validate:"required" json:"reciever"`
}

type ConnectionDocument struct {
	ID        primitive.ObjectID    `bson:"_id" json:"id"`
	Requester UserExtendedReference `validate:"required" json:"requester"`
	Reciever  primitive.ObjectID    `validate:"required" json:"reciever"`
	Timestamp time.Time             `bson:"timestamp" json:"timestamp"`
}

type UpdateConnectionDocument struct {
	// idk what goes here
}

/*
Connection Service to be used by Connection Handler to interact with the
Database layer of the application
*/

type Service struct {
	Connections *mongo.Collection
}
