package Profile

import (
	"context"

	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Profiles: collections["users"],
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
					{Key: "$meta", Value: "textScore"},
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

