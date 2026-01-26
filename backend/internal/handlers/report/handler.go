package report

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/xvalidator"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ReportPostHuma handles reporting a post
func (h *Handler) ReportPostHuma(ctx context.Context, input *ReportPostInput) (*ReportPostOutput, error) {
	// Validate input
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert IDs to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	postObjID, err := primitive.ObjectIDFromHex(input.PostID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid post ID", err)
	}

	// Create report
	report, err := h.service.ReportPost(ctx, userObjID, postObjID, input.Body.Reason, input.Body.Description)
	if err != nil {
		if err.Error() == "post not found" {
			return nil, huma.Error404NotFound("Post not found", err)
		}
		if err.Error() == "you have already reported this content" {
			return nil, huma.Error409Conflict("You have already reported this content", err)
		}
		slog.Error("Failed to report post", "error", err, "user_id", user_id, "post_id", input.PostID)
		return nil, huma.Error500InternalServerError("Failed to submit report", err)
	}

	resp := &ReportPostOutput{}
	resp.Body.Message = "Report submitted successfully. Thank you for helping keep Kindred safe."
	resp.Body.ReportID = report.ID.Hex()

	return resp, nil
}

// ReportCommentHuma handles reporting a comment
func (h *Handler) ReportCommentHuma(ctx context.Context, input *ReportCommentInput) (*ReportCommentOutput, error) {
	// Validate input
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// Convert IDs to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(user_id)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID", err)
	}

	commentObjID, err := primitive.ObjectIDFromHex(input.CommentID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid comment ID", err)
	}

	// Create report
	report, err := h.service.ReportComment(ctx, userObjID, commentObjID, input.Body.Reason, input.Body.Description)
	if err != nil {
		if err.Error() == "comment not found" {
			return nil, huma.Error404NotFound("Comment not found", err)
		}
		if err.Error() == "you have already reported this content" {
			return nil, huma.Error409Conflict("You have already reported this content", err)
		}
		slog.Error("Failed to report comment", "error", err, "user_id", user_id, "comment_id", input.CommentID)
		return nil, huma.Error500InternalServerError("Failed to submit report", err)
	}

	resp := &ReportCommentOutput{}
	resp.Body.Message = "Report submitted successfully. Thank you for helping keep Kindred safe."
	resp.Body.ReportID = report.ID.Hex()

	return resp, nil
}

// GetReportsHuma handles retrieving reports (admin only)
func (h *Handler) GetReportsHuma(ctx context.Context, input *GetReportsInput) (*GetReportsOutput, error) {
	// Extract user_id from context (set by auth middleware)
	user_id, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Authentication required", err)
	}

	// TODO: Add admin check here when admin roles are implemented
	// For now, any authenticated user can view reports (should be restricted in production)
	slog.Info("Reports requested", "user_id", user_id)

	// Set defaults for pagination
	limit := input.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	// Get reports
	reports, total, err := h.service.GetReports(ctx, input.Status, limit, offset)
	if err != nil {
		slog.Error("Failed to get reports", "error", err)
		return nil, huma.Error500InternalServerError("Failed to retrieve reports", err)
	}

	// Convert to API format
	apiReports := make([]types.ReportDocumentAPI, len(reports))
	for i, report := range reports {
		apiReports[i] = *report.ToAPI()
	}

	resp := &GetReportsOutput{}
	resp.Body.Reports = apiReports
	resp.Body.Total = total

	return resp, nil
}
