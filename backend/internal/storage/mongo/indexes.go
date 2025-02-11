package mongo

import (
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
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
		Collection: "jobs",
		Model:      mongo.IndexModel{Keys: bson.M{"location": "2d"}},
	},
}
