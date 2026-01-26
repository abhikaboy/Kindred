package report

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// RegisterReportPostOperation registers the report post endpoint
func RegisterReportPostOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "report-post",
		Method:      http.MethodPost,
		Path:        "/v1/user/reports/post/{postId}",
		Summary:     "Report a post",
		Description: "Report a post for inappropriate content, spam, harassment, or other violations",
		Tags:        []string{"reports"},
	}, func(ctx context.Context, input *ReportPostInput) (*ReportPostOutput, error) {
		return handler.ReportPostHuma(ctx, input)
	})
}

// RegisterReportCommentOperation registers the report comment endpoint
func RegisterReportCommentOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "report-comment",
		Method:      http.MethodPost,
		Path:        "/v1/user/reports/comment/{commentId}",
		Summary:     "Report a comment",
		Description: "Report a comment for inappropriate content, spam, harassment, or other violations",
		Tags:        []string{"reports"},
	}, func(ctx context.Context, input *ReportCommentInput) (*ReportCommentOutput, error) {
		return handler.ReportCommentHuma(ctx, input)
	})
}

// RegisterGetReportsOperation registers the get reports endpoint
func RegisterGetReportsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-reports",
		Method:      http.MethodGet,
		Path:        "/v1/admin/reports",
		Summary:     "Get reports",
		Description: "Retrieve content reports for moderation (admin only)",
		Tags:        []string{"reports"},
	}, func(ctx context.Context, input *GetReportsInput) (*GetReportsOutput, error) {
		return handler.GetReportsHuma(ctx, input)
	})
}

// RegisterReportOperations registers all report operations
func RegisterReportOperations(api huma.API, handler *Handler) {
	RegisterReportPostOperation(api, handler)
	RegisterReportCommentOperation(api, handler)
	RegisterGetReportsOperation(api, handler)
}
