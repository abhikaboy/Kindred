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
	// Separate partial unique indexes for each auth method
	// These only enforce uniqueness when the field exists and is not empty
	// Using $gt: "" (greater than empty string) to exclude empty strings
	{
		Collection: "users",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "email", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.D{
					{Key: "email", Value: bson.D{{Key: "$gt", Value: ""}}},
				}),
		},
	},
	{
		Collection: "users",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "apple_id", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.D{
					{Key: "apple_id", Value: bson.D{{Key: "$gt", Value: ""}}},
				}),
		},
	},
	{
		Collection: "users",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "google_id", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.D{
					{Key: "google_id", Value: bson.D{{Key: "$gt", Value: ""}}},
				}),
		},
	},
	{
		Collection: "waitlist",
		Model: mongo.IndexModel{Keys: bson.D{
			{Key: "email", Value: 1},
		},
			Options: options.Index().SetUnique(true),
		},
	},
	// Referrals collection indexes
	{
		Collection: "referrals",
		Model: mongo.IndexModel{
			Keys:    bson.D{{Key: "userId", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	},
	{
		Collection: "referrals",
		Model: mongo.IndexModel{
			Keys:    bson.D{{Key: "referralCode", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	},
	{
		Collection: "referrals",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "referredUsers.userId", Value: 1}},
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
					{Key: "dynamic", Value: false},
					{Key: "fields", Value: bson.D{
						// Full-text search fields
						{Key: "display_name", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						{Key: "handle", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						// Autocomplete fields
						{Key: "display_name", Value: bson.D{
							{Key: "type", Value: "autocomplete"},
							{Key: "analyzer", Value: "lucene.standard"},
							{Key: "tokenization", Value: "edgeGram"},
							{Key: "minGrams", Value: 2},
							{Key: "maxGrams", Value: 15},
							{Key: "foldDiacritics", Value: true},
						}},
						{Key: "handle", Value: bson.D{
							{Key: "type", Value: "autocomplete"},
							{Key: "analyzer", Value: "lucene.standard"},
							{Key: "tokenization", Value: "edgeGram"},
							{Key: "minGrams", Value: 2},
							{Key: "maxGrams", Value: 15},
							{Key: "foldDiacritics", Value: true},
						}},
					}},
				}}},
			Options: options.SearchIndexes().SetName("display_name_text"),
		},
	},
	{
		Collection: "blueprints",
		Model: mongo.SearchIndexModel{
			Definition: bson.D{
				{Key: "mappings", Value: bson.D{
					{Key: "dynamic", Value: false},
					{Key: "fields", Value: bson.D{
						// Full-text search fields
						{Key: "name", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						{Key: "description", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						{Key: "tags", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						{Key: "owner.handle", Value: bson.D{
							{Key: "type", Value: "string"},
							{Key: "analyzer", Value: "lucene.standard"},
						}},
						// Autocomplete fields
						{Key: "name", Value: bson.D{
							{Key: "type", Value: "autocomplete"},
							{Key: "analyzer", Value: "lucene.standard"},
							{Key: "tokenization", Value: "edgeGram"},
							{Key: "minGrams", Value: 2},
							{Key: "maxGrams", Value: 15},
							{Key: "foldDiacritics", Value: true},
						}},
						{Key: "owner.handle", Value: bson.D{
							{Key: "type", Value: "autocomplete"},
							{Key: "analyzer", Value: "lucene.standard"},
							{Key: "tokenization", Value: "edgeGram"},
							{Key: "minGrams", Value: 2},
							{Key: "maxGrams", Value: 15},
							{Key: "foldDiacritics", Value: true},
						}},
					}},
				}},
			},
			Options: options.SearchIndexes().SetName("blueprints_text"),
		},
	},
}
