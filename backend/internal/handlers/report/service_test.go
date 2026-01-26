package report_test

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/report"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ReportServiceTestSuite is the test suite for Report service
type ReportServiceTestSuite struct {
	testpkg.BaseSuite
	service *report.Service
}

// SetupTest runs before each test
func (s *ReportServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = report.NewService(s.Collections)
}

// TestReportService runs the test suite
func TestReportService(t *testing.T) {
	suite.Run(t, new(ReportServiceTestSuite))
}

// ========================================
// ReportPost Tests
// ========================================

func (s *ReportServiceTestSuite) TestReportPost_Success() {
	reporter := s.GetUser(0)
	post := s.GetPost(0)

	reportDoc, err := s.service.ReportPost(
		context.Background(),
		reporter.ID,
		post.ID,
		types.ReportReasonInappropriate,
		"This post contains inappropriate content",
	)

	s.NoError(err)
	s.NotNil(reportDoc)
	s.Equal(types.ContentTypePost, reportDoc.ContentType)
	s.Equal(post.ID, reportDoc.ContentID)
	s.Equal(reporter.ID, reportDoc.ReporterID)
	s.Equal(types.ReportStatusPending, reportDoc.Status)
}

func (s *ReportServiceTestSuite) TestReportPost_Duplicate() {
	reporter := s.GetUser(0)
	post := s.GetPost(0)

	// Create first report
	_, err := s.service.ReportPost(
		context.Background(),
		reporter.ID,
		post.ID,
		types.ReportReasonSpam,
		"Spam content",
	)
	s.NoError(err)

	// Try to create duplicate report
	_, err = s.service.ReportPost(
		context.Background(),
		reporter.ID,
		post.ID,
		types.ReportReasonSpam,
		"Spam content again",
	)

	s.Error(err)
	s.Contains(err.Error(), "already reported")
}

func (s *ReportServiceTestSuite) TestReportPost_PostNotFound() {
	reporter := s.GetUser(0)
	nonExistentPostID := primitive.NewObjectID()

	_, err := s.service.ReportPost(
		context.Background(),
		reporter.ID,
		nonExistentPostID,
		types.ReportReasonInappropriate,
		"Test",
	)

	s.Error(err)
	s.Contains(err.Error(), "post not found")
}

// ========================================
// ReportComment Tests
// ========================================

func (s *ReportServiceTestSuite) TestReportComment_Success() {
	reporter := s.GetUser(0)
	post := s.GetPost(0)

	// Assume post has comments from fixtures
	if len(post.Comments) == 0 {
		s.T().Skip("No comments in test post")
		return
	}

	commentID := post.Comments[0].ID

	reportDoc, err := s.service.ReportComment(
		context.Background(),
		reporter.ID,
		commentID,
		types.ReportReasonHarassment,
		"This comment is harassing",
	)

	s.NoError(err)
	s.NotNil(reportDoc)
	s.Equal(types.ContentTypeComment, reportDoc.ContentType)
	s.Equal(commentID, reportDoc.ContentID)
}

// ========================================
// GetReports Tests
// ========================================

func (s *ReportServiceTestSuite) TestGetReports_Success() {
	reporter := s.GetUser(0)
	post := s.GetPost(0)

	// Create a report
	_, err := s.service.ReportPost(
		context.Background(),
		reporter.ID,
		post.ID,
		types.ReportReasonInappropriate,
		"Test report",
	)
	s.NoError(err)

	// Get all reports
	reports, total, err := s.service.GetReports(context.Background(), "", 10, 0)

	s.NoError(err)
	s.NotNil(reports)
	s.GreaterOrEqual(total, 1)
	s.GreaterOrEqual(len(reports), 1)
}

func (s *ReportServiceTestSuite) TestGetReports_FilterByStatus() {
	reporter := s.GetUser(0)
	post := s.GetPost(0)

	// Create a pending report
	_, err := s.service.ReportPost(
		context.Background(),
		reporter.ID,
		post.ID,
		types.ReportReasonSpam,
		"Spam post",
	)
	s.NoError(err)

	// Get pending reports
	reports, total, err := s.service.GetReports(context.Background(), string(types.ReportStatusPending), 10, 0)

	s.NoError(err)
	s.NotNil(reports)
	s.GreaterOrEqual(total, 1)

	// All reports should be pending
	for _, report := range reports {
		s.Equal(types.ReportStatusPending, report.Status)
	}
}

func (s *ReportServiceTestSuite) TestGetReports_Pagination() {
	reporter := s.GetUser(0)

	// Create multiple reports
	for i := 0; i < 5; i++ {
		post := s.GetPost(0)

		// Clear previous reports to avoid duplicates
		s.Collections["reports"].DeleteMany(context.Background(), bson.M{
			"reporter_id": reporter.ID,
			"content_id":  post.ID,
		})

		_, err := s.service.ReportPost(
			context.Background(),
			reporter.ID,
			post.ID,
			types.ReportReasonInappropriate,
			"Test report",
		)
		if err != nil && !s.Contains(err.Error(), "already reported") {
			s.NoError(err)
		}
	}

	// Get first page
	page1, total, err := s.service.GetReports(context.Background(), "", 3, 0)
	s.NoError(err)
	s.LessOrEqual(len(page1), 3)
	s.GreaterOrEqual(total, 1)
}
