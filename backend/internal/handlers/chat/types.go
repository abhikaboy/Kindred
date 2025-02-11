package chat

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type CreateChatParams struct {
	Sender  primitive.ObjectID `validate:"required" json:"sender"`
	Room    primitive.ObjectID `validate:"required" json:"room"`
	Content string             `validate:"required" json:"content"`
}

type ChatDocument struct {
	ID        primitive.ObjectID `bson:"_id" json:"_id"`
	Sender    primitive.ObjectID `bson:"sender" json:"sender"`
	Room      primitive.ObjectID `bson:"room" json:"room"`
	Content   string             `bson:"content" json:"content"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

type UpdateChatDocument struct {
	Content string `bson:"content" json:"content"`
}

/*
Chat Service to be used by Chat Handler to interact with the
Database layer of the application
*/

type Service struct {
	Chats *mongo.Collection
}
