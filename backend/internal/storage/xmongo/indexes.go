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
	// Encouragements collection indexes
	// Compound index for efficient lookup of encouragements by task and receiver
	// This is used when a task is completed to find all encouragers to notify
	{
		Collection: "encouragements",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "taskId", Value: 1},
				{Key: "receiver", Value: 1},
			},
			Options: options.Index().SetName("taskId_receiver_idx"),
		},
	},
	// Index for looking up encouragements by receiver (for displaying user's encouragements)
	{
		Collection: "encouragements",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "receiver", Value: 1}},
		},
	},
	// Calendar connections indexes
	{
		Collection: "calendar_connections",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "provider", Value: 1},
			},
		},
	},
	{
		Collection: "calendar_connections",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "provider_account_id", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
	},
	// Unique index on tasks.integration to prevent duplicate calendar events
	{
		Collection: "categories",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "tasks.integration", Value: 1}},
			Options: options.Index().
				SetUnique(true).
				SetSparse(true).
				SetPartialFilterExpression(bson.D{
					{Key: "tasks.integration", Value: bson.D{{Key: "$exists", Value: true}}},
					{Key: "tasks.integration", Value: bson.D{{Key: "$ne", Value: ""}}},
				}),
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
						// Multi-type field definition for display_name
						// Supports both "text" and "autocomplete" search operators
						{Key: "display_name", Value: bson.A{
							// String type for full-text search
							bson.D{
								{Key: "type", Value: "string"},
								{Key: "analyzer", Value: "lucene.standard"},
							},
							// Autocomplete type for autocomplete search
							bson.D{
								{Key: "type", Value: "autocomplete"},
								{Key: "analyzer", Value: "lucene.standard"},
								{Key: "tokenization", Value: "edgeGram"},
								{Key: "minGrams", Value: 2},
								{Key: "maxGrams", Value: 15},
								{Key: "foldDiacritics", Value: true},
							},
						}},
						// Multi-type field definition for handle
						// Supports both "text" and "autocomplete" search operators
						{Key: "handle", Value: bson.A{
							// String type for full-text search
							bson.D{
								{Key: "type", Value: "string"},
								{Key: "analyzer", Value: "lucene.standard"},
							},
							// Autocomplete type for autocomplete search
							bson.D{
								{Key: "type", Value: "autocomplete"},
								{Key: "analyzer", Value: "lucene.standard"},
								{Key: "tokenization", Value: "edgeGram"},
								{Key: "minGrams", Value: 2},
								{Key: "maxGrams", Value: 15},
								{Key: "foldDiacritics", Value: true},
							},
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
