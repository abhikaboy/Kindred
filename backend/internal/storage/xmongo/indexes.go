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

type SearchIndex struct {
	Collection string
	Model      mongo.SearchIndexModel
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
	// {
	// 	Collection: "users",
	// 	Model: mongo.IndexModel{Keys: bson.D{
	// 		{Key: "display_name", Value: "text"},
	// 		{Key: "handle", Value: "text"},
	// 	},
	// 	Options: options.Index().
	// 		SetName("display_name_handle_text_index").
	// 		SetWeights(bson.M{
	// 			"display_name": 2,
	// 			"handle":       1,
	// 		}),
	// 	},
	// },
}


var SearchIndexes = []SearchIndex{
	{
		Collection: "users",
		Model: mongo.SearchIndexModel{
			Definition: bson.D{
				{Key: "mappings", Value: bson.D{
					{Key: "dynamic", Value: true},
					{Key: "fields", Value: bson.D{
						{Key: "display_name", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						},
						},
						{Key: "handle", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						},
					},	
					},
				},
			}}},
			Options: options.SearchIndexes().SetName("display_name_text"),
		},
	},
}
