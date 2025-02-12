package xmongo

import (
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

/*
Indexes struct
*/
type Index struct {
	Collection string
	Model      mongo.IndexModel
}

/*
Indexes to be applied to the database.
*/
var Indexes = []Index{
	{
		Collection: "users",
		Model: mongo.IndexModel{Keys: bson.D{
			{Key: "apple_id", Value: 1},
			{Key: "email", Value: 1},
			{Key: "google_id", Value: 1},
		},
			Options: options.Index().SetUnique(true),
		},
	},
}
