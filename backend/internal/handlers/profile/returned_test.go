package Profile

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestShouldRecordReturnIdempotentWithin24h(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	at := func(d time.Duration) *time.Time { v := now.Add(-d); return &v }

	assert.True(t, shouldRecordReturn(nil, now), "first call records")
	assert.False(t, shouldRecordReturn(at(0), now), "immediate repeat is ignored")
	assert.False(t, shouldRecordReturn(at(time.Hour), now))
	assert.False(t, shouldRecordReturn(at(23*time.Hour+59*time.Minute), now))
	assert.True(t, shouldRecordReturn(at(24*time.Hour), now), "exactly 24h later records again")
	assert.True(t, shouldRecordReturn(at(72*time.Hour), now))
}

func TestMarkReturnedFilterEncodesDebounce(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	id := primitive.NewObjectID()
	f := markReturnedFilter(id, now)

	assert.Equal(t, id, f["_id"])
	or := f["$or"].(bson.A)
	assert.Len(t, or, 2)
	assert.Equal(t, bson.M{"returnedAt": nil}, or[0])
	assert.Equal(t, bson.M{"returnedAt": bson.M{"$lte": now.Add(-24 * time.Hour)}}, or[1])
}
