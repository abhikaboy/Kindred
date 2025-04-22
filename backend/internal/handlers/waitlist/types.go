package Waitlist

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateWaitlistParams struct {
	Email string `validate:"required,email" json:"email"`
	Name  string `validate:"required" json:"name"`
}

type WaitlistDocument struct {
	ID        primitive.ObjectID `bson:"_id" json:"id"`
	Email string `validate:"required,email" json:"email"`
	Name  string `validate:"required" json:"name"`
	Timestamp time.Time `validate:"required" json:"timestamp"`
}


/*
Waitlist Service to be used by Waitlist Handler to interact with the
Database layer of the application
*/

type Service struct {
	Waitlists *mongo.Collection
}
