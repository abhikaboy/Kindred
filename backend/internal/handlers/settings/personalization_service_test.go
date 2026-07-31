package settings_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/settings"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PersonalizationServiceTestSuite covers the `user_memory` side of settings —
// the consent flags the productivity-agent worker reads, and the `stated` rows
// Kindred owns in the collection it shares with that worker.
type PersonalizationServiceTestSuite struct {
	testpkg.BaseSuite
	service *settings.Service
}

func (s *PersonalizationServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = settings.NewService(s.Collections)
}

func TestPersonalizationService(t *testing.T) {
	suite.Run(t, new(PersonalizationServiceTestSuite))
}

// makeLegacyUser strips `settings.personalization` from a fixture user,
// reproducing every account that existed before the field shipped.
func (s *PersonalizationServiceTestSuite) makeLegacyUser(userID primitive.ObjectID) {
	_, err := s.Collections["users"].UpdateOne(s.Ctx,
		bson.M{"_id": userID},
		bson.M{"$unset": bson.M{"settings.personalization": ""}},
	)
	s.Require().NoError(err)
}

// workerSeesAsEligible replays the worker's own consent filter
// (mongo-kindred.adapter.ts) against the stored document. This is the only
// assertion that actually proves a user has not been switched off — everything
// else is our reading of our own struct.
func (s *PersonalizationServiceTestSuite) workerSeesAsEligible(userID primitive.ObjectID) bool {
	now := time.Now().UTC()
	count, err := s.Collections["users"].CountDocuments(s.Ctx, bson.M{
		"_id":                              userID,
		"settings.personalization.enabled": bson.M{"$ne": false},
		"$or": []bson.M{
			{"settings.personalization.pausedUntil": bson.M{"$exists": false}},
			{"settings.personalization.pausedUntil": bson.M{"$lte": now}},
		},
	})
	s.Require().NoError(err)
	return count == 1
}

func (s *PersonalizationServiceTestSuite) findFact(userID primitive.ObjectID, key string) bson.M {
	var doc bson.M
	err := s.Collections["user_memory"].FindOne(s.Ctx, bson.M{"userId": userID, "key": key}).Decode(&doc)
	s.Require().NoError(err)
	return doc
}

// ========================================
// Existing users must not be switched off
// ========================================

func (s *PersonalizationServiceTestSuite) TestLegacyUser_CountsAsEnabled() {
	user := s.GetUser(0)
	s.makeLegacyUser(user.ID)

	s.True(s.workerSeesAsEligible(user.ID), "a user with no personalization field must still be distilled")

	loaded, err := s.service.GetUserSettings(user.ID)
	s.NoError(err)
	s.Require().NotNil(loaded.Personalization)
	s.True(loaded.Personalization.Enabled, "absent must read as enabled")
}

func (s *PersonalizationServiceTestSuite) TestGetUserSettings_DoesNotPersistTheDefault() {
	user := s.GetUser(0)
	s.makeLegacyUser(user.ID)

	_, err := s.service.GetUserSettings(user.ID)
	s.NoError(err)

	// Reading must stay a read. Writing the default here would be a migration
	// in disguise, and the point of "absent means enabled" is that no migration
	// is needed.
	var stored bson.M
	s.Require().NoError(s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&stored))
	storedSettings, _ := stored["settings"].(bson.M)
	s.NotContains(storedSettings, "personalization")
}

func (s *PersonalizationServiceTestSuite) TestUpdateUserSettings_LeavesPersonalizationAlone() {
	user := s.GetUser(0)
	s.makeLegacyUser(user.ID)

	// A client that predates personalization sends the settings blob it knows
	// about. The zero value of the new field must not ride along with it.
	err := s.service.UpdateUserSettings(user.ID, types.UserSettings{
		Notifications: types.NotificationSettings{FriendPosts: true},
	})
	s.NoError(err)

	s.True(s.workerSeesAsEligible(user.ID), "an unrelated settings PATCH must not opt anyone out")

	var stored bson.M
	s.Require().NoError(s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&stored))
	storedSettings, _ := stored["settings"].(bson.M)
	s.NotContains(storedSettings, "personalization")
}

func (s *PersonalizationServiceTestSuite) TestUpdateUserSettings_CannotReEnableThroughTheBlob() {
	user := s.GetUser(0)

	disabled := false
	_, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{Enabled: &disabled})
	s.Require().NoError(err)

	// A stale settings blob claiming personalization is on must not undo the
	// opt-out; consent only moves through UpdatePersonalization.
	enabled := types.PersonalizationSettings{Enabled: true}
	err = s.service.UpdateUserSettings(user.ID, types.UserSettings{Personalization: &enabled})
	s.NoError(err)

	s.False(s.workerSeesAsEligible(user.ID))
}

func (s *PersonalizationServiceTestSuite) TestDefaultUserSettings_EnablesPersonalization() {
	defaults := types.DefaultUserSettings()

	s.Require().NotNil(defaults.Personalization)
	s.True(defaults.Personalization.Enabled)
	s.Nil(defaults.Personalization.PausedUntil)
}

// ========================================
// UpdatePersonalization
// ========================================

func (s *PersonalizationServiceTestSuite) TestUpdatePersonalization_OptOutWritesExplicitFalse() {
	user := s.GetUser(0)

	disabled := false
	result, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{Enabled: &disabled})

	s.NoError(err)
	s.False(result.Enabled)
	s.False(s.workerSeesAsEligible(user.ID))
}

func (s *PersonalizationServiceTestSuite) TestUpdatePersonalization_PauseHidesUserFromWorker() {
	user := s.GetUser(0)
	until := time.Now().UTC().Add(48 * time.Hour)

	result, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{PausedUntil: &until})

	s.NoError(err)
	s.Require().NotNil(result.PausedUntil)
	s.True(result.Enabled, "pausing is not opting out")
	s.False(s.workerSeesAsEligible(user.ID))
}

func (s *PersonalizationServiceTestSuite) TestUpdatePersonalization_EnablingClearsThePause() {
	user := s.GetUser(0)
	until := time.Now().UTC().Add(48 * time.Hour)

	_, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{PausedUntil: &until})
	s.Require().NoError(err)

	enabled := true
	result, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{Enabled: &enabled})

	s.NoError(err)
	s.True(result.Enabled)
	s.Nil(result.PausedUntil, "turning it back on must not leave a stale pause behind")
	s.True(s.workerSeesAsEligible(user.ID))
}

func (s *PersonalizationServiceTestSuite) TestUpdatePersonalization_EmptyRequestChangesNothing() {
	user := s.GetUser(0)
	s.makeLegacyUser(user.ID)

	result, err := s.service.UpdatePersonalization(user.ID, settings.UpdatePersonalizationRequest{})

	s.NoError(err)
	s.True(result.Enabled)

	var stored bson.M
	s.Require().NoError(s.Collections["users"].FindOne(s.Ctx, bson.M{"_id": user.ID}).Decode(&stored))
	storedSettings, _ := stored["settings"].(bson.M)
	s.NotContains(storedSettings, "personalization")
}

// ========================================
// Export
// ========================================

func (s *PersonalizationServiceTestSuite) TestExportPersonalizationData_ReturnsFactsWithoutPromptText() {
	user := s.GetUser(0)
	expires := time.Now().UTC().Add(45 * 24 * time.Hour)
	_, err := s.Collections["user_memory"].InsertOne(s.Ctx, bson.M{
		"userId":     user.ID,
		"key":        "deadline-adherence",
		"kind":       "reliability",
		"content":    "Deadlines read as aspiration rather than commitment — avoid framing them as failures.",
		"confidence": 0.61,
		"evidence":   bson.M{"sampleSize": 40, "windowDays": 90, "metRate": 0.24},
		"source":     "derived",
		"createdAt":  time.Now().UTC(),
		"updatedAt":  time.Now().UTC(),
		"expiresAt":  expires,
	})
	s.Require().NoError(err)

	facts, consent, err := s.service.ExportPersonalizationData(user.ID)

	s.NoError(err)
	s.Require().Len(facts, 1)
	s.Equal("deadline-adherence", facts[0].Key)
	s.Equal("reliability", facts[0].Kind)
	s.Equal("derived", facts[0].Source)
	s.EqualValues(40, facts[0].Evidence["sampleSize"])
	s.NotNil(facts[0].ExpiresAt)
	s.True(consent.Enabled)

	// `content` is an instruction written for a language model, and this one is
	// the example the contract calls out: showing "avoid framing them as
	// failures" to the user is the exact failure it warns about. The user-facing
	// numbers live in `evidence`.
	payload, err := json.Marshal(facts[0])
	s.Require().NoError(err)
	s.NotContains(string(payload), "avoid framing them as failures")
}

func (s *PersonalizationServiceTestSuite) TestExportPersonalizationData_EmptyForNewUser() {
	user := s.GetUser(0)

	facts, consent, err := s.service.ExportPersonalizationData(user.ID)

	s.NoError(err)
	s.Empty(facts)
	s.NotNil(consent)
}

// ========================================
// Delete
// ========================================

func (s *PersonalizationServiceTestSuite) TestDeletePersonalizationData_ErasesAndDisables() {
	user := s.GetUser(0)
	other := s.GetUser(1)

	_, err := s.Collections["user_memory"].InsertMany(s.Ctx, []any{
		bson.M{"userId": user.ID, "key": "peak-hours", "source": "derived"},
		bson.M{"userId": user.ID, "key": "tone", "source": "stated"},
		bson.M{"userId": other.ID, "key": "peak-hours", "source": "derived"},
	})
	s.Require().NoError(err)

	deleted, err := s.service.DeletePersonalizationData(user.ID)

	s.NoError(err)
	s.EqualValues(2, deleted)

	// Deleting without disabling would let the next nightly run rebuild exactly
	// what the user just erased. This assertion is the whole point.
	s.False(s.workerSeesAsEligible(user.ID), "delete must also turn personalization off")

	s.EqualValues(0, s.CountDocuments("user_memory", bson.M{"userId": user.ID}))
	s.EqualValues(1, s.CountDocuments("user_memory", bson.M{"userId": other.ID}), "another user's data must be untouched")
}

func (s *PersonalizationServiceTestSuite) TestDeletePersonalizationData_UnknownUser() {
	deleted, err := s.service.DeletePersonalizationData(testpkg.NewObjectID())

	s.Error(err)
	s.EqualValues(0, deleted)
}

// ========================================
// Stated facts
// ========================================

func (s *PersonalizationServiceTestSuite) TestSaveStatedPreferences_WritesAllFourKeys() {
	user := s.GetUser(0)

	keys, err := s.service.SaveStatedPreferences(user.ID, settings.StatedPreferencesRequest{
		PlanningStyle:  "detailed",
		Tone:           "direct",
		NudgeFrequency: "occasionally",
		PeakHours:      "night",
	}, settings.SurfaceOnboarding)

	s.NoError(err)
	s.ElementsMatch([]string{"planning-style", "tone", "nudge-frequency", "peak-hours"}, keys)
	s.EqualValues(4, s.CountDocuments("user_memory", bson.M{"userId": user.ID}))
}

func (s *PersonalizationServiceTestSuite) TestSaveStatedPreferences_ShapeMatchesTheContract() {
	user := s.GetUser(0)

	_, err := s.service.SaveStatedPreferences(user.ID, settings.StatedPreferencesRequest{PeakHours: "night"}, settings.SurfaceOnboarding)
	s.Require().NoError(err)

	doc := s.findFact(user.ID, "peak-hours")

	// userId has to be a real ObjectId: the worker matches on ObjectId, and a
	// hex string would be invisible to it and to the Go read path.
	_, isObjectID := doc["userId"].(primitive.ObjectID)
	s.True(isObjectID, "userId must be an ObjectId, not a string")

	s.Equal("stated", doc["source"])
	s.Equal(1.0, doc["confidence"])
	s.Equal("rhythm", doc["kind"], "must match the derived fact with the same key")
	s.NotEmpty(doc["content"])
	s.NotNil(doc["createdAt"])
	s.NotNil(doc["updatedAt"])

	// The TTL index on `user_memory` has no idea what `source` means, so a
	// stated answer carrying an expiresAt would quietly evaporate.
	s.NotContains(doc, "expiresAt")

	evidence, ok := doc["evidence"].(bson.M)
	s.Require().True(ok)
	s.EqualValues(0, evidence["sampleSize"])
	s.EqualValues(0, evidence["windowDays"])
	s.Equal("onboarding", evidence["surface"])
	s.NotNil(evidence["statedAt"])
	s.Equal("night", evidence["value"])
	s.EqualValues(21, evidence["windowStartHour"])
	s.EqualValues(24, evidence["windowEndHour"])
}

func (s *PersonalizationServiceTestSuite) TestSaveStatedPreferences_SkipsBlankAnswers() {
	user := s.GetUser(0)

	keys, err := s.service.SaveStatedPreferences(user.ID, settings.StatedPreferencesRequest{Tone: "playful"}, settings.SurfaceOnboarding)

	s.NoError(err)
	s.Equal([]string{"tone"}, keys)
	s.EqualValues(1, s.CountDocuments("user_memory", bson.M{"userId": user.ID}))
}

func (s *PersonalizationServiceTestSuite) TestSaveStatedPreferences_RejectsUnknownValue() {
	user := s.GetUser(0)

	_, err := s.service.SaveStatedPreferences(user.ID, settings.StatedPreferencesRequest{Tone: "sarcastic"}, settings.SurfaceOnboarding)

	s.Error(err)
	s.EqualValues(0, s.CountDocuments("user_memory", bson.M{"userId": user.ID}), "a rejected answer must not write a partial set")
}

func (s *PersonalizationServiceTestSuite) TestUpdateStatedFact_OverwritesDerivedAndDropsItsExpiry() {
	user := s.GetUser(0)
	expires := time.Now().UTC().Add(45 * 24 * time.Hour)
	_, err := s.Collections["user_memory"].InsertOne(s.Ctx, bson.M{
		"userId":     user.ID,
		"key":        "peak-hours",
		"kind":       "rhythm",
		"content":    "Completes most work between 9pm and midnight local time.",
		"confidence": 0.83,
		"evidence":   bson.M{"sampleSize": 25, "windowDays": 90},
		"source":     "derived",
		"createdAt":  time.Now().UTC(),
		"updatedAt":  time.Now().UTC(),
		"expiresAt":  expires,
	})
	s.Require().NoError(err)

	err = s.service.UpdateStatedFact(user.ID, "peak-hours", "morning", settings.SurfaceSettings)
	s.NoError(err)

	doc := s.findFact(user.ID, "peak-hours")
	s.Equal("stated", doc["source"])
	s.Equal(1.0, doc["confidence"])
	s.NotContains(doc, "expiresAt", "the derived fact's TTL must not outlive it and take the stated answer with it")

	evidence, ok := doc["evidence"].(bson.M)
	s.Require().True(ok)
	s.Equal("morning", evidence["value"])
	s.Equal("settings", evidence["surface"])
	s.EqualValues(0, evidence["sampleSize"])

	s.EqualValues(1, s.CountDocuments("user_memory", bson.M{"userId": user.ID, "key": "peak-hours"}), "the correction upserts, it does not duplicate")
}

func (s *PersonalizationServiceTestSuite) TestUpdateStatedFact_PreservesCreatedAt() {
	user := s.GetUser(0)

	s.Require().NoError(s.service.UpdateStatedFact(user.ID, "tone", "direct", settings.SurfaceOnboarding))
	first := s.findFact(user.ID, "tone")

	s.Require().NoError(s.service.UpdateStatedFact(user.ID, "tone", "playful", settings.SurfaceSettings))
	second := s.findFact(user.ID, "tone")

	s.Equal(first["createdAt"], second["createdAt"], "known-since must survive a correction")
	s.NotEqual(first["content"], second["content"])
}

func (s *PersonalizationServiceTestSuite) TestUpdateStatedFact_RejectsUnknownKey() {
	user := s.GetUser(0)

	err := s.service.UpdateStatedFact(user.ID, "favourite-colour", "blue", settings.SurfaceSettings)

	s.Error(err)
}

func (s *PersonalizationServiceTestSuite) TestUpdateStatedFact_RejectsMismatchedValue() {
	user := s.GetUser(0)

	// "morning" is a peak-hours answer, not a tone.
	err := s.service.UpdateStatedFact(user.ID, "tone", "morning", settings.SurfaceSettings)

	s.Error(err)
	s.EqualValues(0, s.CountDocuments("user_memory", bson.M{"userId": user.ID}))
}

func (s *PersonalizationServiceTestSuite) TestStatedFacts_SurviveTheWorkersPrune() {
	user := s.GetUser(0)
	s.Require().NoError(s.service.UpdateStatedFact(user.ID, "tone", "direct", settings.SurfaceOnboarding))

	// Replay pruneMissingKeys for a nightly run that produced nothing for
	// "tone". The worker's `source != "stated"` filter is what saves it, and it
	// only works because Kindred wrote that exact value.
	res, err := s.Collections["user_memory"].DeleteMany(s.Ctx, bson.M{
		"userId": user.ID,
		"key":    bson.M{"$nin": []string{"peak-hours"}},
		"source": bson.M{"$ne": "stated"},
	})
	s.Require().NoError(err)

	s.EqualValues(0, res.DeletedCount)
	s.EqualValues(1, s.CountDocuments("user_memory", bson.M{"userId": user.ID, "key": "tone"}))
}

func (s *PersonalizationServiceTestSuite) TestValidateStatedAnswer() {
	s.NoError(settings.ValidateStatedAnswer(settings.StatedKeyPlanningStyle, "flexible"))
	s.NoError(settings.ValidateStatedAnswer(settings.StatedKeyNudgeFrequency, "regularly"))
	s.Error(settings.ValidateStatedAnswer(settings.StatedKeyPlanningStyle, "regularly"))
	s.Error(settings.ValidateStatedAnswer("nonsense", "flexible"))
}
