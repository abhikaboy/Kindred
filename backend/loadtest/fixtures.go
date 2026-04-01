package main

import (
	"fmt"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TestUser struct {
	types.User
}

type LoadTestFixtures struct {
	Users      []TestUser
	Categories []types.CategoryDocument
	Posts      []types.PostDocument
}

func NewLoadTestFixtures() *LoadTestFixtures {
	users := generateUsers(50)
	categories := generateCategories(users)
	posts := generatePosts(users)

	return &LoadTestFixtures{
		Users:      users,
		Categories: categories,
		Posts:      posts,
	}
}

func (f *LoadTestFixtures) AsMap() map[string][]interface{} {
	userDocs := make([]interface{}, len(f.Users))
	for i, u := range f.Users {
		userDocs[i] = u.User
	}

	catDocs := make([]interface{}, len(f.Categories))
	for i, c := range f.Categories {
		catDocs[i] = c
	}

	postDocs := make([]interface{}, len(f.Posts))
	for i, p := range f.Posts {
		postDocs[i] = p
	}

	return map[string][]interface{}{
		"users":           userDocs,
		"categories":      catDocs,
		"posts":           postDocs,
		"friend-requests": {},
		"activity":        {},
		"blueprints":      {},
		"chats":           {},
		"completed-tasks": {},
		"congratulations": {},
		"encouragements":  {},
		"groups":          {},
		"notifications":   {},
		"referrals":       {},
		"template-tasks":  {},
		"waitlist":        {},
	}
}

func generateUsers(n int) []TestUser {
	users := make([]TestUser, n)
	for i := range n {
		users[i] = TestUser{
			User: types.User{
				ID:              primitive.NewObjectID(),
				Email:           fmt.Sprintf("loadtest-%d@example.com", i),
				Password:        "hashed_password",
				DisplayName:     fmt.Sprintf("Load Test User %d", i),
				Handle:          fmt.Sprintf("ltuser%d", i),
				Count:           1.0,
				PushToken:       fmt.Sprintf("lt_push_%d", i),
				Encouragements:  5,
				Congratulations: 5,
				ProfilePicture:  fmt.Sprintf("https://example.com/lt_pic_%d.jpg", i),
				Friends:         []primitive.ObjectID{},
				Settings:        types.DefaultUserSettings(),
				Timezone:        "America/New_York",
			},
		}
	}
	return users
}

func generateCategories(users []TestUser) []types.CategoryDocument {
	catNames := []string{"Work", "Personal", "Health", "Learning"}
	taskContents := [][]string{
		{"Finish report", "Update slides", "Review PR", "Write tests", "Deploy staging"},
		{"Grocery shopping", "Call mom", "Clean kitchen", "Read book", "Walk the dog"},
		{"Morning run", "Gym session", "Meal prep", "Drink water", "Stretch routine"},
		{"Study Go", "Read docs", "Watch tutorial", "Practice problems", "Write notes"},
	}

	var categories []types.CategoryDocument
	now := time.Now()

	for _, u := range users {
		for ci, name := range catNames {
			catID := primitive.NewObjectID()
			tasks := make([]types.TaskDocument, len(taskContents[ci]))
			for ti, content := range taskContents[ci] {
				tasks[ti] = types.TaskDocument{
					ID:         primitive.NewObjectID(),
					Priority:   (ti % 3) + 1,
					Content:    content,
					Value:      float64((ti%10)+1) * 0.5,
					Public:     ti%2 == 0,
					Active:     true,
					Timestamp:  now.Add(-time.Duration(ti) * time.Hour),
					LastEdited: now,
					UserID:     u.ID,
					CategoryID: catID,
					StartDate:  &now,
				}
			}
			categories = append(categories, types.CategoryDocument{
				ID:            catID,
				Name:          name,
				WorkspaceName: "Default",
				LastEdited:    now,
				Tasks:         tasks,
				User:          u.ID,
			})
		}
	}
	return categories
}

func generatePosts(users []TestUser) []types.PostDocument {
	var posts []types.PostDocument
	now := time.Now()

	captions := []string{
		"Just finished a big project!",
		"Hit my daily goal today",
		"New personal record at the gym",
		"Learned something new about Go",
		"Productive morning routine",
	}

	for i, u := range users {
		for j, caption := range captions {
			if (i+j)%3 != 0 {
				continue
			}
			posts = append(posts, types.PostDocument{
				ID:      primitive.NewObjectID(),
				Caption: caption,
				User: types.UserExtendedReferenceInternal{
					ID:             u.ID,
					DisplayName:    u.DisplayName,
					Handle:         u.Handle,
					ProfilePicture: u.ProfilePicture,
				},
				Images: []string{fmt.Sprintf("https://example.com/img_%d_%d.jpg", i, j)},
				Metadata: types.PostMetadata{
					CreatedAt: now.Add(-time.Duration(i*len(captions)+j) * time.Minute),
					IsDeleted: false,
				},
				Reactions: map[string][]primitive.ObjectID{},
				Comments:  []types.CommentDocument{},
			})
		}
	}
	return posts
}
