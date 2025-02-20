package socket

import (
	"context"
	"log/slog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{collections["sample"]}
}

func (s *Service) LeaveRoom(userId string) error {
	// remove the socketID from the user document

	slog.LogAttrs(context.Background(), slog.LevelInfo, "Leaving Room", slog.String("userId", userId))

	// turns the user id into an ObjectID
	id, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		return err
	}
	filter := bson.M{"_id": id}
	update := bson.M{"$set": bson.M{"socketID": nil}}

	_, err = s.sample.UpdateOne(context.Background(), filter, update)

	if err != nil {
		return err
	}
	return nil
}

func (s *Service) JoinRoom(userId string, socketId string) error {

	// turns the user id into an ObjectID
	id, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		return err
	}

	filter := bson.M{"_id": id}
	update := bson.M{"$set": bson.M{"socketID": socketId}}

	_, err = s.sample.UpdateOne(context.Background(), filter, update)

	if err != nil {
		return err
	}

	return nil
}
