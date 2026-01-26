package report

import (
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	Reports *mongo.Collection
	Posts   *mongo.Collection
	Users   *mongo.Collection
}

type Handler struct {
	service *Service
}

// newService creates a new report service
func newService(collections map[string]*mongo.Collection) *Service {
	return &Service{
		Reports: collections["reports"],
		Posts:   collections["posts"],
		Users:   collections["users"],
	}
}

// NewService is the exported version for testing
func NewService(collections map[string]*mongo.Collection) *Service {
	return newService(collections)
}

// Input/Output types for report operations

// Report Post
type ReportPostInput struct {
	Authorization string            `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	PostID        string            `path:"postId" example:"507f1f77bcf86cd799439011" doc:"Post ID to report"`
	Body          ReportPostRequest `json:"body"`
}

type ReportPostRequest struct {
	Reason      types.ReportReason `json:"reason" validate:"required" example:"inappropriate" doc:"Reason for reporting"`
	Description string             `json:"description,omitempty" example:"This post contains offensive content" doc:"Optional additional details"`
}

type ReportPostOutput struct {
	Body struct {
		Message  string `json:"message" example:"Report submitted successfully"`
		ReportID string `json:"report_id"`
	}
}

// Report Comment
type ReportCommentInput struct {
	Authorization string               `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	CommentID     string               `path:"commentId" example:"507f1f77bcf86cd799439011" doc:"Comment ID to report"`
	Body          ReportCommentRequest `json:"body"`
}

type ReportCommentRequest struct {
	Reason      types.ReportReason `json:"reason" validate:"required" example:"spam" doc:"Reason for reporting"`
	Description string             `json:"description,omitempty" example:"This comment is spam" doc:"Optional additional details"`
}

type ReportCommentOutput struct {
	Body struct {
		Message  string `json:"message" example:"Report submitted successfully"`
		ReportID string `json:"report_id"`
	}
}

// Get Reports (Admin)
type GetReportsInput struct {
	Authorization string `header:"Authorization" required:"true" doc:"Bearer token for authentication"`
	Status        string `query:"status" example:"pending" doc:"Filter by status (pending, reviewed, resolved)"`
	Limit         int    `query:"limit" example:"50" doc:"Number of reports to return"`
	Offset        int    `query:"offset" example:"0" doc:"Offset for pagination"`
}

type GetReportsOutput struct {
	Body struct {
		Reports []types.ReportDocumentAPI `json:"reports"`
		Total   int                       `json:"total"`
	}
}
