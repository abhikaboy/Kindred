package Waitlist_test

import (
	"testing"

	Waitlist "github.com/abhikaboy/Kindred/internal/handlers/waitlist"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// WaitlistServiceTestSuite is the test suite for Waitlist service
type WaitlistServiceTestSuite struct {
	testpkg.BaseSuite
	service *Waitlist.Service
}

// SetupTest runs before each test
func (s *WaitlistServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = Waitlist.NewService(s.Collections)
}

// TestWaitlistService runs the test suite
func TestWaitlistService(t *testing.T) {
	suite.Run(t, new(WaitlistServiceTestSuite))
}

// ========================================
// CreateWaitlist Tests
// ========================================

func (s *WaitlistServiceTestSuite) TestCreateWaitlist_Success() {
	newWaitlist := &Waitlist.WaitlistDocumentInternal{
		Email: "test@example.com",
		Name:  "Test User",
	}

	result, err := s.service.CreateWaitlist(newWaitlist)

	s.NoError(err)
	s.NotNil(result)
	s.NotEmpty(result.ID)
	s.Equal("test@example.com", result.Email)
}

// ========================================
// GetWaitlistByID Tests
// ========================================

func (s *WaitlistServiceTestSuite) TestGetWaitlistByID_Success() {
	// Create a waitlist entry first
	newWaitlist := &Waitlist.WaitlistDocumentInternal{
		Email: "findme@example.com",
		Name:  "Find Me",
	}

	created, err := s.service.CreateWaitlist(newWaitlist)
	s.NoError(err)

	waitlistID, err := primitive.ObjectIDFromHex(created.ID)
	s.NoError(err)

	// Retrieve it
	result, err := s.service.GetWaitlistByID(waitlistID)

	s.NoError(err)
	s.NotNil(result)
	s.Equal(created.ID, result.ID)
}

func (s *WaitlistServiceTestSuite) TestGetWaitlistByID_NotFound() {
	nonExistentID := primitive.NewObjectID()

	result, err := s.service.GetWaitlistByID(nonExistentID)

	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
	s.Nil(result)
}

// ========================================
// GetAllWaitlists Tests
// ========================================

func (s *WaitlistServiceTestSuite) TestGetAllWaitlists_Success() {
	waitlists, err := s.service.GetAllWaitlists()

	s.NoError(err)
	s.NotNil(waitlists)
	s.GreaterOrEqual(len(waitlists), 0)
}

// ========================================
// DeleteWaitlist Tests
// ========================================

func (s *WaitlistServiceTestSuite) TestDeleteWaitlist_Success() {
	// Create a waitlist entry
	newWaitlist := &Waitlist.WaitlistDocumentInternal{
		Email: "delete@example.com",
		Name:  "Delete Me",
	}

	created, err := s.service.CreateWaitlist(newWaitlist)
	s.NoError(err)

	waitlistID, err := primitive.ObjectIDFromHex(created.ID)
	s.NoError(err)

	// Delete it
	err = s.service.DeleteWaitlist(waitlistID)

	s.NoError(err)

	// Verify it's deleted
	_, err = s.service.GetWaitlistByID(waitlistID)
	s.Error(err)
	s.Equal(mongo.ErrNoDocuments, err)
}
