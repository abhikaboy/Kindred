package Activity

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// newService receives the map of collections and picks out Jobs
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Activitys: collections["activity"],
	}
}

// GetAllActivitys fetches all Activity documents from MongoDB
func (s *Service) GetAllActivitys() ([]ActivityDocument, error) {
	ctx := context.Background()
	cursor, err := s.Activitys.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []ActivityDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetActivityByID returns a single Activity document by its ObjectID
func (s *Service) GetActivityByID(id primitive.ObjectID) (*ActivityDocument, error) {
	ctx := context.Background()
	filter := bson.M{"_id": id}

	var Activity ActivityDocument
	err := s.Activitys.FindOne(ctx, filter).Decode(&Activity)

	if err == mongo.ErrNoDocuments {
		// No matching Activity found
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		// Different error occurred
		return nil, err
	}

	return &Activity, nil
}

// GetActivityByUserAndPeriod returns activity for a specific user, year, and month
func (s *Service) GetActivityByUserAndPeriod(userID primitive.ObjectID, year int, month int) (*ActivityDocument, error) {
	ctx := context.Background()
	filter := bson.M{
		"user":  userID,
		"year":  year,
		"month": month,
	}

	var activity ActivityDocument
	err := s.Activitys.FindOne(ctx, filter).Decode(&activity)

	if err == mongo.ErrNoDocuments {
		return nil, mongo.ErrNoDocuments
	} else if err != nil {
		return nil, err
	}

	return &activity, nil
}

// GetActivityByUserAndYear returns all activities for a specific user and year
func (s *Service) GetActivityByUserAndYear(userID primitive.ObjectID, year int) ([]ActivityDocument, error) {
	ctx := context.Background()
	filter := bson.M{
		"user": userID,
		"year": year,
	}

	cursor, err := s.Activitys.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var activities []ActivityDocument
	if err := cursor.All(ctx, &activities); err != nil {
		return nil, err
	}

	return activities, nil
}

// GetRecentActivity returns the user's activity for the last 8 days
func (s *Service) GetRecentActivity(userID primitive.ObjectID) ([]ActivityDocument, error) {
	// Get current date
	now := xutils.NowUTC()
	currentYear := now.Year()
	currentMonth := int(now.Month()) - 1 // Convert to 0-indexed (January = 0, February = 1, etc.)
	currentDay := now.Day()
	
	// Calculate the start date (8 days ago)
	startDate := now.AddDate(0, 0, -7) // 7 days back to get 8 days total
	startYear := startDate.Year()
	startMonth := int(startDate.Month()) - 1 // Convert to 0-indexed
	startDay := startDate.Day()
	
	// Log the date range we're looking for
	slog.LogAttrs(context.Background(), slog.LevelInfo, "GetRecentActivity called", 
		slog.String("userID", userID.Hex()),
		slog.Int("currentYear", currentYear),
		slog.Int("currentMonth", currentMonth),
		slog.Int("currentDay", currentDay),
		slog.Int("startYear", startYear),
		slog.Int("startMonth", startMonth),
		slog.Int("startDay", startDay),
	)
	
	// For debugging - let's first try to get ALL activities for this user
	ctx := context.Background()
	filter := bson.M{"user": userID}
	cursor, err := s.Activitys.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var allUserActivities []ActivityDocument
	if err := cursor.All(ctx, &allUserActivities); err != nil {
		return nil, err
	}
	
	// If no activities found for user, return empty slice
	if len(allUserActivities) == 0 {
		slog.LogAttrs(context.Background(), slog.LevelInfo, "No activities found for user", 
			slog.String("userID", userID.Hex()),
		)
		return []ActivityDocument{}, nil
	}
	
	// Log what activities were found
	slog.LogAttrs(context.Background(), slog.LevelInfo, "Found activities for user", 
		slog.String("userID", userID.Hex()),
		slog.Int("activityCount", len(allUserActivities)),
	)
	
	// Log details of each activity found
	for i, activity := range allUserActivities {
		slog.LogAttrs(context.Background(), slog.LevelInfo, "Activity details", 
			slog.Int("index", i),
			slog.Int("year", activity.Year),
			slog.Int("month", activity.Month),
			slog.Int("dayCount", len(activity.Days)),
		)
	}
	
	var activities []ActivityDocument
	
	// If start and current are in the same month
	if startYear == currentYear && startMonth == currentMonth {
		slog.LogAttrs(context.Background(), slog.LevelInfo, "Same month logic", 
			slog.Int("currentYear", currentYear),
			slog.Int("currentMonth", currentMonth),
		)
		
		// Find activity for current month
		var currentActivity *ActivityDocument
		for i := range allUserActivities {
			if allUserActivities[i].Year == currentYear && allUserActivities[i].Month == currentMonth {
				currentActivity = &allUserActivities[i]
				slog.LogAttrs(context.Background(), slog.LevelInfo, "Found current month activity", 
					slog.Int("totalDays", len(currentActivity.Days)),
				)
				break
			}
		}
		
		if currentActivity != nil {
			// Filter days to only include the last 8 days
			var filteredDays []types.ActivityDay
			for _, day := range currentActivity.Days {
				slog.LogAttrs(context.Background(), slog.LevelInfo, "Checking day", 
					slog.Int("day", day.Day),
					slog.Int("startDay", startDay),
					slog.Int("currentDay", currentDay),
					slog.Bool("inRange", day.Day >= startDay && day.Day <= currentDay),
				)
				if day.Day >= startDay && day.Day <= currentDay {
					filteredDays = append(filteredDays, day)
				}
			}
			slog.LogAttrs(context.Background(), slog.LevelInfo, "Filtering complete", 
				slog.Int("originalDays", len(currentActivity.Days)),
				slog.Int("filteredDays", len(filteredDays)),
			)
			if len(filteredDays) > 0 {
				currentActivity.Days = filteredDays
				activities = append(activities, *currentActivity)
			}
		} else {
			slog.LogAttrs(context.Background(), slog.LevelInfo, "No current month activity found")
		}
	} else {
		// Activity spans across months, need to get both months
		
		// Find activity for start month
		var startActivity *ActivityDocument
		for i := range allUserActivities {
			if allUserActivities[i].Year == startYear && allUserActivities[i].Month == startMonth {
				startActivity = &allUserActivities[i]
				break
			}
		}
		
		if startActivity != nil {
			// Filter days to only include days from start date onwards
			var filteredDays []types.ActivityDay
			for _, day := range startActivity.Days {
				if day.Day >= startDay {
					filteredDays = append(filteredDays, day)
				}
			}
			if len(filteredDays) > 0 {
				startActivity.Days = filteredDays
				activities = append(activities, *startActivity)
			}
		}
		
		// Find activity for current month
		var currentActivity *ActivityDocument
		for i := range allUserActivities {
			if allUserActivities[i].Year == currentYear && allUserActivities[i].Month == currentMonth {
				currentActivity = &allUserActivities[i]
				break
			}
		}
		
		if currentActivity != nil {
			// Filter days to only include days up to current day
			var filteredDays []types.ActivityDay
			for _, day := range currentActivity.Days {
				if day.Day <= currentDay {
					filteredDays = append(filteredDays, day)
				}
			}
			if len(filteredDays) > 0 {
				currentActivity.Days = filteredDays
				activities = append(activities, *currentActivity)
			}
		}
	}
	
	return activities, nil
}
