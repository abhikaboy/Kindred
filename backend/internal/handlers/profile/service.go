package Profile

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	Connection "github.com/abhikaboy/Kindred/internal/handlers/connection"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// NewService receives the map of collections and picks out Jobs
func NewService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Profiles:       collections["users"],
		Connections:    collections["friend-requests"],
		Tasks:          collections["categories"],
		CompletedTasks: collections["completed-tasks"],
		Posts:          collections["posts"],
		Groups:         collections["groups"],
		Blueprints:     collections["blueprints"],
		Notifications:  collections["notifications"],
	}
}

// GetAllProfiles fetches all Profile documents from MongoDB
func (s *Service) GetAllProfiles() ([]ProfileDocument, error) {
	ctx := context.Background()
	cursor, err := s.Profiles.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []ProfileDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetProfileByID returns a single Profile document by its ObjectID
func (s *Service) GetProfileByID(id primitive.ObjectID) (*ProfileDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Profile ProfileDocument
	err := s.Profiles.FindOne(ctx, filter).Decode(&Profile)

	if err == mongo.ErrNoDocuments {
		// No matching Profile found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Profile, nil
}

func (s *Service) GetProfileByEmail(email string) (*ProfileDocument, error) {
	ctx := context.Background()
	filter := bson.M{"email": email}

	var Profile ProfileDocument
	err := s.Profiles.FindOne(ctx, filter).Decode(&Profile)
	if err == mongo.ErrNoDocuments {
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		return nil, err
	}

	return &Profile, nil
}

func (s *Service) GetProfileByPhone(phone string) (*ProfileDocument, error) {
	ctx := context.Background()
	filter := bson.M{"phone": phone}

	var Profile ProfileDocument
	err := s.Profiles.FindOne(ctx, filter).Decode(&Profile)
	if err == mongo.ErrNoDocuments {
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		return nil, err
	}

	return &Profile, nil
}

func (s *Service) SearchProfiles(query string) ([]ProfileDocument, error) {
	ctx := context.Background()

	var results = make([]ProfileDocument, 0)

	pipeline := mongo.Pipeline{
		// $search stage using Atlas Search
		bson.D{
			{Key: "$search", Value: bson.D{
				// Specify your index name
				{Key: "index", Value: "display_name_text"},
				// Use compound to search across multiple fields with weights
				{Key: "compound", Value: bson.D{
					{Key: "should", Value: bson.A{
						// Search in display_name with higher weight
						bson.D{
							{Key: "text", Value: bson.D{
								{Key: "query", Value: query},
								{Key: "path", Value: "display_name"},
								{Key: "fuzzy", Value: bson.D{
									{Key: "maxEdits", Value: 2},
									{Key: "prefixLength", Value: 1},
									{Key: "maxExpansions", Value: 10},
								}},
								{Key: "score", Value: bson.D{
									{Key: "boost", Value: bson.D{
										{Key: "value", Value: 1},
									}},
								}},
							}},
						},
						// Search in handle with lower weight
						bson.D{
							{Key: "text", Value: bson.D{
								{Key: "query", Value: query},
								{Key: "path", Value: "handle"},
								{Key: "fuzzy", Value: bson.D{
									{Key: "maxEdits", Value: 2},
									{Key: "prefixLength", Value: 1},
									{Key: "maxExpansions", Value: 10},
								}},
								{Key: "score", Value: bson.D{
									{Key: "boost", Value: bson.D{
										{Key: "value", Value: 1},
									}},
								}},
							}},
						},
					}},
				}},
			}},
		},
		// $project stage to include score
		bson.D{
			{Key: "$addFields", Value: bson.D{
				{Key: "score", Value: bson.D{
					{Key: "$meta", Value: "searchScore"},
				}},
			}},
		},
		// $sort stage to sort by score
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "score", Value: -1},
			}},
		},
	}
	cursor, err := s.Profiles.Aggregate(ctx, pipeline)
	if err == mongo.ErrNoDocuments {
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

func (s *Service) AutocompleteProfiles(query string) ([]ProfileDocument, error) {
	ctx := context.Background()

	var results = make([]ProfileDocument, 0)

	pipeline := mongo.Pipeline{
		// $search stage using autocomplete
		bson.D{
			{Key: "$search", Value: bson.D{
				{Key: "index", Value: "display_name_text"},
				{Key: "compound", Value: bson.D{
					{Key: "should", Value: bson.A{
						// Autocomplete on display_name with higher boost
						bson.D{
							{Key: "autocomplete", Value: bson.D{
								{Key: "query", Value: query},
								{Key: "path", Value: "display_name"},
								{Key: "tokenOrder", Value: "sequential"},
								{Key: "fuzzy", Value: bson.D{
									{Key: "maxEdits", Value: 1},
									{Key: "prefixLength", Value: 1},
								}},
								{Key: "score", Value: bson.D{
									{Key: "boost", Value: bson.D{
										{Key: "value", Value: 2},
									}},
								}},
							}},
						},
						// Autocomplete on handle
						bson.D{
							{Key: "autocomplete", Value: bson.D{
								{Key: "query", Value: query},
								{Key: "path", Value: "handle"},
								{Key: "tokenOrder", Value: "sequential"},
								{Key: "fuzzy", Value: bson.D{
									{Key: "maxEdits", Value: 1},
									{Key: "prefixLength", Value: 1},
								}},
								{Key: "score", Value: bson.D{
									{Key: "boost", Value: bson.D{
										{Key: "value", Value: 1},
									}},
								}},
							}},
						},
					}},
				}},
			}},
		},
		// Add search score
		bson.D{
			{Key: "$addFields", Value: bson.D{
				{Key: "score", Value: bson.D{
					{Key: "$meta", Value: "searchScore"},
				}},
			}},
		},
		// Sort by score
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "score", Value: -1},
			}},
		},
		// Limit results for autocomplete
		bson.D{
			{Key: "$limit", Value: 10},
		},
	}

	cursor, err := s.Profiles.Aggregate(ctx, pipeline)
	if err == mongo.ErrNoDocuments {
		return []ProfileDocument{}, nil
	} else if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// UpdatePartialProfile updates only specified fields of a Profile document by ObjectID.
// If any denormalized fields (display_name, handle, profile_picture) change, propagates
// the update to all embedded UserExtendedReferences across collections.
func (s *Service) UpdatePartialProfile(id primitive.ObjectID, updated UpdateProfileDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Profiles.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	// Check if any denormalized fields changed and propagate
	propagate := bson.M{}
	if updated.DisplayName != "" {
		propagate["display_name"] = updated.DisplayName
	}
	if updated.Handle != "" {
		propagate["handle"] = updated.Handle
	}
	if updated.ProfilePicture != nil {
		propagate["profile_picture"] = *updated.ProfilePicture
	}
	if len(propagate) > 0 {
		go s.propagateUserRefFields(id, propagate)
	}

	return nil
}

// DeleteProfile removes a Profile document by ObjectID.
func (s *Service) DeleteProfile(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Profiles.DeleteOne(ctx, filter)
	return err
}

// UpdateProfilePicture updates the profile picture URL for a specific user
// and propagates the change to all embedded UserExtendedReferences across collections.
func (s *Service) UpdateProfilePicture(id primitive.ObjectID, pictureURL string) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	update := bson.M{
		"$set": bson.M{
			"profile_picture": pictureURL,
		},
	}

	_, err := s.Profiles.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	// Propagate to all embedded references in background.
	go s.propagateUserRefFields(id, bson.M{"profile_picture": pictureURL})

	return nil
}

// propagateUserRefFields updates denormalized UserExtendedReferenceInternal fields
// across all collections that embed them. `fields` should be a map of field names
// to new values (e.g. {"profile_picture": url} or {"display_name": name, "handle": handle}).
//
// Runs all collection updates concurrently with a 30s timeout.
func (s *Service) propagateUserRefFields(userID primitive.ObjectID, fields bson.M) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Build $set maps for each embedding pattern
	topLevel := bson.M{}        // "user.field" or "owner.field"
	commentArraySet := bson.M{} // "comments.$[comment].user.field"
	memberArraySet := bson.M{}  // "members.$[member].field"

	for field, value := range fields {
		topLevel["user."+field] = value
		commentArraySet["comments.$[comment].user."+field] = value
		memberArraySet["members.$[member]."+field] = value
	}

	ownerSet := bson.M{}
	for field, value := range fields {
		ownerSet["owner."+field] = value
	}

	type updateJob struct {
		name       string
		collection *mongo.Collection
		filter     bson.M
		update     bson.M
		opts       []*options.UpdateOptions
	}

	jobs := []updateJob{
		{
			name:       "posts (author)",
			collection: s.Posts,
			filter:     bson.M{"user._id": userID},
			update:     bson.M{"$set": topLevel},
		},
		{
			name:       "posts (comments)",
			collection: s.Posts,
			filter:     bson.M{"comments.user._id": userID},
			update:     bson.M{"$set": commentArraySet},
			opts: []*options.UpdateOptions{
				options.Update().SetArrayFilters(options.ArrayFilters{
					Filters: []interface{}{bson.M{"comment.user._id": userID}},
				}),
			},
		},
		{
			name:       "groups",
			collection: s.Groups,
			filter:     bson.M{"members._id": userID},
			update:     bson.M{"$set": memberArraySet},
			opts: []*options.UpdateOptions{
				options.Update().SetArrayFilters(options.ArrayFilters{
					Filters: []interface{}{bson.M{"member._id": userID}},
				}),
			},
		},
		{
			name:       "blueprints",
			collection: s.Blueprints,
			filter:     bson.M{"owner._id": userID},
			update:     bson.M{"$set": ownerSet},
		},
		{
			name:       "notifications",
			collection: s.Notifications,
			filter:     bson.M{"user._id": userID},
			update:     bson.M{"$set": topLevel},
		},
	}

	var wg sync.WaitGroup
	for _, job := range jobs {
		if job.collection == nil {
			continue
		}
		wg.Add(1)
		go func(j updateJob) {
			defer wg.Done()
			var err error
			if len(j.opts) > 0 {
				_, err = j.collection.UpdateMany(ctx, j.filter, j.update, j.opts...)
			} else {
				_, err = j.collection.UpdateMany(ctx, j.filter, j.update)
			}
			if err != nil {
				slog.Error("Failed to propagate user reference fields",
					"collection", j.name,
					"userID", userID.Hex(),
					"error", err,
				)
			}
		}(job)
	}

	wg.Wait()
}

// UpdateTimezone updates the timezone for a specific user and increments count to invalidate tokens
func (s *Service) UpdateTimezone(id primitive.ObjectID, timezone string) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	update := bson.M{
		"$set": bson.M{
			"timezone": timezone,
		},
		"$inc": bson.M{
			"count": 1, // Increment count to invalidate existing tokens
		},
	}

	_, err := s.Profiles.UpdateOne(ctx, filter, update)
	return err
}

func (s *Service) GetProfileTasks(userID primitive.ObjectID) ([]types.TaskDocument, error) {
	ctx := context.Background()
	var pipeline []bson.D = []bson.D{
		{
			{Key: "$match", Value: bson.M{"user": userID}},
		},
		{
			{Key: "$unwind", Value: "$tasks"},
		},
		{
			{Key: "$replaceRoot", Value: bson.M{
				"newRoot": "$tasks",
			}},
		},
		{
			{Key: "$match", Value: bson.M{"public": true}},
		},
	}
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var tasks []types.TaskDocument
	if err := cursor.All(ctx, &tasks); err != nil {
		return nil, err
	}

	return tasks, nil
}

func (s *Service) GetProfileCompletedTasks(userID primitive.ObjectID, limit int) ([]types.TaskDocument, error) {
	ctx := context.Background()

	findOptions := options.Find().
		SetSort(bson.D{{Key: "timeCompleted", Value: -1}}).
		SetLimit(int64(limit))

	filter := bson.M{
		"user":   userID,
		"public": true,
	}

	cursor, err := s.CompletedTasks.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var tasks []types.TaskDocument
	if err := cursor.All(ctx, &tasks); err != nil {
		return nil, err
	}

	return tasks, nil
}

func (s *Service) CheckRelationship(userAID, userBID primitive.ObjectID) (*RelationshipInfo, error) {
	ctx := context.Background()

	// Check for self connection first
	if userAID == userBID {
		return &RelationshipInfo{Status: RelationshipSelf}, nil
	}

	// Sort IDs to match how they're stored
	sortedIDs := Connection.SortUserIDs(userAID, userBID)

	var relationship Connection.ConnectionDocumentInternal
	err := s.Connections.FindOne(ctx, bson.M{"users": sortedIDs}).Decode(&relationship)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return &RelationshipInfo{Status: RelationshipNone}, nil
		}
		return &RelationshipInfo{Status: RelationshipNone}, err
	}

	// Convert connection relationship to profile relationship info
	return s.convertConnectionToRelationshipInfo(relationship, userAID), nil
}

// convertConnectionToRelationshipInfo converts a Connection.ConnectionDocumentInternal to RelationshipInfo
func (s *Service) convertConnectionToRelationshipInfo(relationship Connection.ConnectionDocumentInternal, userAID primitive.ObjectID) *RelationshipInfo {
	switch relationship.Status {
	case Connection.StatusFriends:
		return &RelationshipInfo{Status: RelationshipConnected}
	case Connection.StatusBlocked:
		return &RelationshipInfo{Status: RelationshipBlocked}
	case Connection.StatusPending:
		// Check who is the requester to determine the relationship type
		if relationship.Requester.ID == userAID {
			requestID := relationship.ID.Hex()
			return &RelationshipInfo{
				Status:    RelationshipRequested,
				RequestID: &requestID,
			}
		}
		requestID := relationship.ID.Hex()
		return &RelationshipInfo{
			Status:    RelationshipReceived,
			RequestID: &requestID,
		}
	default:
		return &RelationshipInfo{Status: RelationshipNone}
	}
}

// GetSuggestedUsers returns up to 8 users with the most friends
func (s *Service) GetSuggestedUsers() ([]types.UserExtendedReference, error) {
	ctx := context.Background()

	pipeline := mongo.Pipeline{
		// Add a field with the size of the friends array
		bson.D{
			{Key: "$addFields", Value: bson.D{
				{Key: "friendsCount", Value: bson.D{
					{Key: "$size", Value: "$friends"},
				}},
			}},
		},
		// Sort by friends count descending
		bson.D{
			{Key: "$sort", Value: bson.D{
				{Key: "friendsCount", Value: -1},
			}},
		},
		// Limit to 8 results
		bson.D{
			{Key: "$limit", Value: 8},
		},
		// Project only the fields needed for UserExtendedReference
		bson.D{
			{Key: "$project", Value: bson.D{
				{Key: "_id", Value: 1},
				{Key: "display_name", Value: 1},
				{Key: "handle", Value: 1},
				{Key: "profile_picture", Value: 1},
			}},
		},
	}

	cursor, err := s.Profiles.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []types.UserExtendedReferenceInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal to API type
	results := make([]types.UserExtendedReference, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}

// parseUserIDs validates and dedupes hex user IDs. Invalid hex is skipped so one
// bad ID doesn't fail the batch; returns an error only when the input exceeds max.
func parseUserIDs(raw []string, max int) ([]primitive.ObjectID, error) {
	if len(raw) > max {
		return nil, fmt.Errorf("too many ids: %d (max %d)", len(raw), max)
	}
	seen := make(map[string]struct{}, len(raw))
	out := make([]primitive.ObjectID, 0, len(raw))
	for _, s := range raw {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		oid, err := primitive.ObjectIDFromHex(s)
		if err != nil {
			continue
		}
		out = append(out, oid)
	}
	return out, nil
}

// FindUsersByPhoneNumbers efficiently finds users matching any of the provided phone numbers
// Uses a single database query with $in operator to avoid multiple scans
// Returns users with phone numbers included for contact name mapping
// Excludes the authenticated user from results
func (s *Service) FindUsersByPhoneNumbers(phoneNumbers []string, excludeUserID primitive.ObjectID) ([]types.UserExtendedReferenceWithPhone, error) {
	ctx := context.Background()

	// Return empty if no phone numbers provided
	if len(phoneNumbers) == 0 {
		return []types.UserExtendedReferenceWithPhone{}, nil
	}

	// Use $in operator for efficient single-query lookup, but exclude the authenticated user
	filter := bson.M{
		"phone": bson.M{
			"$in": phoneNumbers,
		},
		"_id": bson.M{
			"$ne": excludeUserID,
		},
	}

	// Project only the fields needed for UserExtendedReferenceWithPhone
	projection := bson.M{
		"_id":             1,
		"display_name":    1,
		"handle":          1,
		"profile_picture": 1,
		"phone":           1, // Include phone to map back to contact names
	}

	cursor, err := s.Profiles.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var internalResults []types.UserExtendedReferenceWithPhoneInternal
	if err := cursor.All(ctx, &internalResults); err != nil {
		return nil, err
	}

	// Convert internal to API type
	results := make([]types.UserExtendedReferenceWithPhone, len(internalResults))
	for i, internal := range internalResults {
		results[i] = *internal.ToAPI()
	}

	return results, nil
}
