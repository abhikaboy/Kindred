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
	// Index on tasks.integration for faster duplicate checking during calendar sync
	// Note: Cannot use unique constraint on array fields, so we check manually in code
	{
		Collection: "categories",
		Model: mongo.IndexModel{
			Keys:    bson.D{{Key: "tasks.integration", Value: 1}},
			Options: options.Index().SetSparse(true),
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
	// Notifications collection indexes
	// Compound index for fetching a user's notifications sorted by time (covers the main query)
	{
		Collection: "notifications",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "receiver", Value: 1},
				{Key: "time", Value: -1},
			},
		},
	},
	// Compound index for unread count queries
	{
		Collection: "notifications",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "receiver", Value: 1},
				{Key: "read", Value: 1},
			},
		},
	},
	// Calendar processed events indexes
	{
		Collection: "calendar_processed_events",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "user_id", Value: 1},
				{Key: "connection_id", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
	},
	{
		Collection: "calendar_processed_events",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "user_id", Value: 1}},
		},
	},
	{
		Collection: "calendar_processed_events",
		Model: mongo.IndexModel{
			Keys: bson.D{{Key: "event_ids", Value: 1}},
		},
	},

	// Posts collection indexes
	// Covers GetAllPosts: filter on isDeleted+isPublic, sort by createdAt
	{
		Collection: "posts",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "metadata.isDeleted", Value: 1},
				{Key: "metadata.isPublic", Value: 1},
				{Key: "metadata.createdAt", Value: -1},
			},
		},
	},
	// Covers GetUserPosts: filter on user._id+isDeleted, sort by createdAt
	{
		Collection: "posts",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "user._id", Value: 1},
				{Key: "metadata.isDeleted", Value: 1},
				{Key: "metadata.createdAt", Value: -1},
			},
		},
	},
	// Covers GetPostsByBlueprint: filter on blueprint.id+isDeleted+isPublic, sort by createdAt
	{
		Collection: "posts",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "blueprint.id", Value: 1},
				{Key: "metadata.isDeleted", Value: 1},
				{Key: "metadata.isPublic", Value: 1},
				{Key: "metadata.createdAt", Value: -1},
			},
		},
	},

	// Friend-requests (connections) collection indexes
	// Covers GetRelationship, IsBlocked, AcceptConnection lookups by user pair
	{
		Collection: "friend-requests",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "users", Value: 1},
				{Key: "status", Value: 1},
			},
		},
	},
	// Covers GetByReciever, GetPendingRequestsByReceiver
	{
		Collection: "friend-requests",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "receiver_id", Value: 1},
				{Key: "status", Value: 1},
			},
		},
	},
	// Covers GetByRequester
	{
		Collection: "friend-requests",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "requester._id", Value: 1},
			},
		},
	},
	// Covers GetBlockedUsers
	{
		Collection: "friend-requests",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "status", Value: 1},
				{Key: "blocker_id", Value: 1},
			},
		},
	},

	// Reports collection indexes
	// Covers GetReportedPostIDs: filter on content_type+status, project content_id
	{
		Collection: "reports",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "content_type", Value: 1},
				{Key: "status", Value: 1},
			},
		},
	},
	// Covers GetUserReportedPostIDs: filter on reporter_id+content_type
	{
		Collection: "reports",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "reporter_id", Value: 1},
				{Key: "content_type", Value: 1},
			},
		},
	},

	// Completed-tasks collection indexes
	// Covers GetProfileCompletedTasks: filter on user+public, sort by timeCompleted
	{
		Collection: "completed-tasks",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "user", Value: 1},
				{Key: "public", Value: 1},
				{Key: "timeCompleted", Value: -1},
			},
		},
	},

	// Groups collection indexes
	// Covers GetUserGroups: filter on creator or members._id, filter isDeleted
	{
		Collection: "groups",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "members._id", Value: 1},
				{Key: "metadata.isDeleted", Value: 1},
			},
		},
	},
	{
		Collection: "groups",
		Model: mongo.IndexModel{
			Keys: bson.D{
				{Key: "creator", Value: 1},
				{Key: "metadata.isDeleted", Value: 1},
			},
		},
	},
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
