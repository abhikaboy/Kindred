package Profile

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ProfileDocument struct {
	ID        primitive.ObjectID `bson:"_id" json:"id"`
	ProfilePicture   *string           `bson:"profile_picture" json:"profile_picture"`
	DisplayName   string           `bson:"display_name" json:"display_name"`
	Handle   string           `bson:"handle" json:"handle"`
	TasksComplete   int           `bson:"tasks_complete" json:"tasks_complete"`
	Friends []primitive.ObjectID `bson:"friends" json:"friends"`

}

type UpdateProfileDocument struct {
	DisplayName   string           `bson:"display_name,omitempty" json:"display_name,omitempty"`
	Handle   string           `bson:"handle,omitempty" json:"handle,omitempty"`
	ProfilePicture   *string           `bson:"profile_picture,omitempty" json:"profile_picture,omitempty"`
}

/*
Profile Service to be used by Profile Handler to interact with the
Database layer of the application
*/

type Service struct {
	Profiles *mongo.Collection
}
