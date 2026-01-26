package testing

import (
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UserBuilder provides a fluent interface for building test users
type UserBuilder struct {
	user types.User
}

// NewUserBuilder creates a new user builder with sensible defaults
func NewUserBuilder() *UserBuilder {
	return &UserBuilder{
		user: types.User{
			ID:              primitive.NewObjectID(),
			Email:           "test@example.com",
			Password:        "password123",
			DisplayName:     "Test User",
			Handle:          "testuser",
			Count:           1.0,
			TokenUsed:       false,
			PushToken:       "test_push_token",
			Encouragements:  2,
			Congratulations: 2,
			ProfilePicture:  "https://example.com/pic.jpg",
			Settings:        types.DefaultUserSettings(),
		},
	}
}

// WithID sets the user ID
func (b *UserBuilder) WithID(id primitive.ObjectID) *UserBuilder {
	b.user.ID = id
	return b
}

// WithEmail sets the email
func (b *UserBuilder) WithEmail(email string) *UserBuilder {
	b.user.Email = email
	return b
}

// WithHandle sets the handle
func (b *UserBuilder) WithHandle(handle string) *UserBuilder {
	b.user.Handle = handle
	return b
}

// WithDisplayName sets the display name
func (b *UserBuilder) WithDisplayName(name string) *UserBuilder {
	b.user.DisplayName = name
	return b
}

// WithTokenUsed sets whether the referral token was used
func (b *UserBuilder) WithTokenUsed(used bool) *UserBuilder {
	b.user.TokenUsed = used
	return b
}

// Build returns the constructed user
func (b *UserBuilder) Build() types.User {
	return b.user
}

// PostBuilder provides a fluent interface for building test posts
type PostBuilder struct {
	post types.PostDocument
}

// NewPostBuilder creates a new post builder with sensible defaults
func NewPostBuilder(user types.User) *PostBuilder {
	now := time.Now()
	return &PostBuilder{
		post: types.PostDocument{
			ID:      primitive.NewObjectID(),
			Caption: "Test post caption",
			User: types.UserExtendedReferenceInternal{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			},
			Images: []string{"https://example.com/image1.jpg"},
			Metadata: types.PostMetadata{
				CreatedAt: now,
				IsDeleted: false,
			},
			Reactions: map[string][]primitive.ObjectID{},
			Comments:  []types.CommentDocument{},
		},
	}
}

// WithCaption sets the caption
func (b *PostBuilder) WithCaption(caption string) *PostBuilder {
	b.post.Caption = caption
	return b
}

// WithImages sets the images
func (b *PostBuilder) WithImages(images []string) *PostBuilder {
	b.post.Images = images
	return b
}

// WithTask sets the task reference
func (b *PostBuilder) WithTask(taskID primitive.ObjectID, content string, category types.CategoryExtendedReference) *PostBuilder {
	b.post.Task = &types.PostTaskExtendedReference{
		ID:       taskID,
		Content:  content,
		Category: category,
	}
	return b
}

// Build returns the constructed post
func (b *PostBuilder) Build() types.PostDocument {
	return b.post
}

// CommentBuilder provides a fluent interface for building test comments
type CommentBuilder struct {
	comment types.CommentDocument
}

// NewCommentBuilder creates a new comment builder with sensible defaults
func NewCommentBuilder(user types.User) *CommentBuilder {
	now := time.Now()
	return &CommentBuilder{
		comment: types.CommentDocument{
			ID:      primitive.NewObjectID(),
			Content: "Test comment",
			User: &types.UserExtendedReferenceInternal{
				ID:             user.ID,
				DisplayName:    user.DisplayName,
				Handle:         user.Handle,
				ProfilePicture: user.ProfilePicture,
			},
			Metadata: types.CommentMetadata{
				CreatedAt: now,
				IsDeleted: false,
			},
		},
	}
}

// WithContent sets the content
func (b *CommentBuilder) WithContent(content string) *CommentBuilder {
	b.comment.Content = content
	return b
}

// WithParentID sets the parent comment ID
func (b *CommentBuilder) WithParentID(parentID primitive.ObjectID) *CommentBuilder {
	b.comment.ParentID = &parentID
	return b
}

// WithMentions sets the mentions
func (b *CommentBuilder) WithMentions(mentions []types.MentionReference) *CommentBuilder {
	b.comment.Mentions = mentions
	return b
}

// Build returns the constructed comment
func (b *CommentBuilder) Build() types.CommentDocument {
	return b.comment
}
