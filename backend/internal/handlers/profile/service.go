package Profile

import (
	"context"

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
		Profiles:    collections["users"],
		Connections: collections["friend-requests"],
		Tasks:       collections["categories"],
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
func (s *Service) UpdatePartialProfile(id primitive.ObjectID, updated UpdateProfileDocument) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	updateFields, err := xutils.ToDoc(updated)
	if err != nil {
		return err
	}

	update := bson.M{"$set": updateFields}

	_, err = s.Profiles.UpdateOne(ctx, filter, update)
	return err
}

// DeleteProfile removes a Profile document by ObjectID.
func (s *Service) DeleteProfile(id primitive.ObjectID) error {
	ctx := context.Background()

	filter := bson.M{"_id": id}

	_, err := s.Profiles.DeleteOne(ctx, filter)
	return err
}

// UpdateProfilePicture updates the profile picture URL for a specific user
func (s *Service) UpdateProfilePicture(id primitive.ObjectID, pictureURL string) error {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	update := bson.M{
		"$set": bson.M{
			"profile_picture": pictureURL,
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
		return &RelationshipInfo{Status: RelationshipNone} // Treat blocked as none for now
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
