package report

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ReportPost creates a report for a post
func (s *Service) ReportPost(ctx context.Context, reporterID, postID primitive.ObjectID, reason types.ReportReason, description string) (*types.ReportDocument, error) {
	// Check if post exists and get owner ID
	var post struct {
		ID   primitive.ObjectID `bson:"_id"`
		User struct {
			ID primitive.ObjectID `bson:"_id"`
		} `bson:"user"`
	}

	err := s.Posts.FindOne(ctx, bson.M{"_id": postID}).Decode(&post)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("post not found")
		}
		return nil, fmt.Errorf("failed to find post: %w", err)
	}

	// Check for duplicate report
	existingReport := s.Reports.FindOne(ctx, bson.M{
		"reporter_id":  reporterID,
		"content_type": types.ContentTypePost,
		"content_id":   postID,
	})

	if existingReport.Err() == nil {
		return nil, fmt.Errorf("you have already reported this content")
	}

	// Create report document
	report := &types.ReportDocument{
		ID:             primitive.NewObjectID(),
		ReporterID:     reporterID,
		ContentType:    types.ContentTypePost,
		ContentID:      postID,
		ContentOwnerID: post.User.ID,
		Reason:         reason,
		Description:    description,
		Status:         types.ReportStatusPending,
		CreatedAt:      time.Now(),
		ReviewedAt:     nil,
	}

	_, err = s.Reports.InsertOne(ctx, report)
	if err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	// Log the report for admin notification
	slog.LogAttrs(ctx, slog.LevelWarn, "Content reported",
		slog.String("reportId", report.ID.Hex()),
		slog.String("contentType", string(report.ContentType)),
		slog.String("contentId", postID.Hex()),
		slog.String("reason", string(reason)),
		slog.String("reporterId", reporterID.Hex()))

	return report, nil
}

// ReportComment creates a report for a comment
func (s *Service) ReportComment(ctx context.Context, reporterID, commentID primitive.ObjectID, reason types.ReportReason, description string) (*types.ReportDocument, error) {
	// Find the post containing this comment to get comment owner
	var post struct {
		ID       primitive.ObjectID      `bson:"_id"`
		Comments []types.CommentDocument `bson:"comments"`
	}

	err := s.Posts.FindOne(ctx, bson.M{"comments._id": commentID}).Decode(&post)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("comment not found")
		}
		return nil, fmt.Errorf("failed to find comment: %w", err)
	}

	// Find the specific comment to get owner ID
	var commentOwnerID primitive.ObjectID
	for _, comment := range post.Comments {
		if comment.ID == commentID {
			if comment.User != nil {
				commentOwnerID = comment.User.ID
			}
			break
		}
	}

	if commentOwnerID.IsZero() {
		return nil, fmt.Errorf("comment owner not found")
	}

	// Check for duplicate report
	existingReport := s.Reports.FindOne(ctx, bson.M{
		"reporter_id":  reporterID,
		"content_type": types.ContentTypeComment,
		"content_id":   commentID,
	})

	if existingReport.Err() == nil {
		return nil, fmt.Errorf("you have already reported this content")
	}

	// Create report document
	report := &types.ReportDocument{
		ID:             primitive.NewObjectID(),
		ReporterID:     reporterID,
		ContentType:    types.ContentTypeComment,
		ContentID:      commentID,
		ContentOwnerID: commentOwnerID,
		Reason:         reason,
		Description:    description,
		Status:         types.ReportStatusPending,
		CreatedAt:      time.Now(),
		ReviewedAt:     nil,
	}

	_, err = s.Reports.InsertOne(ctx, report)
	if err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	// Log the report for admin notification
	slog.LogAttrs(ctx, slog.LevelWarn, "Content reported",
		slog.String("reportId", report.ID.Hex()),
		slog.String("contentType", string(report.ContentType)),
		slog.String("contentId", commentID.Hex()),
		slog.String("reason", string(reason)),
		slog.String("reporterId", reporterID.Hex()))

	return report, nil
}

// GetReports retrieves reports with optional filtering
func (s *Service) GetReports(ctx context.Context, status string, limit, offset int) ([]types.ReportDocument, int, error) {
	filter := bson.M{}

	// Add status filter if provided
	if status != "" {
		filter["status"] = status
	}

	// Count total matching reports
	total, err := s.Reports.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count reports: %w", err)
	}

	// Find reports with pagination
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}). // Most recent first
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := s.Reports.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to find reports: %w", err)
	}
	defer cursor.Close(ctx)

	var reports []types.ReportDocument
	if err := cursor.All(ctx, &reports); err != nil {
		return nil, 0, fmt.Errorf("failed to decode reports: %w", err)
	}

	return reports, int(total), nil
}
