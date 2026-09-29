package mcpserver

import (
	"context"
	"strings"
	"testing"

	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestGenerateToken_Format(t *testing.T) {
	raw, err := generateToken()
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(raw, tokenPrefix))
	assert.Len(t, raw, len(tokenPrefix)+43)
	assert.True(t, tokenWellFormed(raw))

	other, err := generateToken()
	require.NoError(t, err)
	assert.NotEqual(t, raw, other)
}

func TestHashToken(t *testing.T) {
	h := hashToken("kdr_example")
	assert.Len(t, h, 64)
	assert.Equal(t, h, hashToken("kdr_example"))
	assert.NotEqual(t, h, hashToken("kdr_example2"))
}

func TestTokenWellFormed(t *testing.T) {
	raw, err := generateToken()
	require.NoError(t, err)
	assert.False(t, tokenWellFormed(""))
	assert.False(t, tokenWellFormed("kdr_short"))
	assert.False(t, tokenWellFormed("xyz_"+raw[len(tokenPrefix):]))
	assert.False(t, tokenWellFormed(raw+"a"))
}

func TestAuthenticate_MalformedSkipsDatabase(t *testing.T) {
	s := &TokenService{}
	_, err := s.Authenticate(context.Background(), "Bearer nope")
	assert.ErrorIs(t, err, ErrInvalidToken)
}

type TokenServiceTestSuite struct {
	testpkg.BaseSuite
	service *TokenService
}

func (s *TokenServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewTokenService(s.Collections)
}

func TestTokenService(t *testing.T) {
	suite.Run(t, new(TokenServiceTestSuite))
}

func (s *TokenServiceTestSuite) TestCreateAndAuthenticate() {
	userID := s.GetUser(0).ID
	raw, doc, err := s.service.Create(s.Ctx, userID, "Claude")
	s.Require().NoError(err)
	s.Equal(raw[:displayPrefixLen], doc.Prefix)
	s.Nil(doc.LastUsedAt)

	var stored bson.M
	s.FindOne(tokensCollection, bson.M{"_id": doc.ID}, &stored)
	s.Equal(hashToken(raw), stored["token_hash"])
	for _, v := range stored {
		s.NotEqual(raw, v, "raw token must never be persisted")
	}

	got, err := s.service.Authenticate(s.Ctx, raw)
	s.Require().NoError(err)
	s.Equal(userID, got)

	var after TokenDocument
	s.FindOne(tokensCollection, bson.M{"_id": doc.ID}, &after)
	s.NotNil(after.LastUsedAt)
}

func (s *TokenServiceTestSuite) TestAuthenticate_UnknownToken() {
	raw, err := generateToken()
	s.Require().NoError(err)
	_, err = s.service.Authenticate(s.Ctx, raw)
	s.ErrorIs(err, ErrInvalidToken)
}

func (s *TokenServiceTestSuite) TestListOmitsHash() {
	userID := s.GetUser(0).ID
	_, _, err := s.service.Create(s.Ctx, userID, "Claude")
	s.Require().NoError(err)

	docs, err := s.service.List(s.Ctx, userID)
	s.Require().NoError(err)
	s.Require().Len(docs, 1)
	s.Empty(docs[0].TokenHash)
}

func (s *TokenServiceTestSuite) TestRevokeScopedToOwner() {
	owner := s.GetUser(0).ID
	raw, doc, err := s.service.Create(s.Ctx, owner, "Claude")
	s.Require().NoError(err)

	s.ErrorIs(s.service.Revoke(s.Ctx, primitive.NewObjectID(), doc.ID), ErrTokenNotFound)
	_, err = s.service.Authenticate(s.Ctx, raw)
	s.NoError(err)

	s.NoError(s.service.Revoke(s.Ctx, owner, doc.ID))
	_, err = s.service.Authenticate(s.Ctx, raw)
	s.ErrorIs(err, ErrInvalidToken)
}

func (s *TokenServiceTestSuite) TestCreateEnforcesLimit() {
	userID := s.GetUser(0).ID
	for i := 0; i < maxTokensPerUser; i++ {
		_, _, err := s.service.Create(s.Ctx, userID, "t")
		s.Require().NoError(err)
	}
	_, _, err := s.service.Create(s.Ctx, userID, "one too many")
	s.ErrorIs(err, ErrTokenLimit)
}
