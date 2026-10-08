package auth

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// memCounterStore mirrors mongoCounterStore's fixed windows without a database.
type memCounterStore struct {
	counts map[string]int
	now    func() time.Time
	err    error
}

func newMemCounterStore(now func() time.Time) *memCounterStore {
	return &memCounterStore{counts: map[string]int{}, now: now}
}

func (m *memCounterStore) Incr(_ context.Context, key string, window time.Duration) (int, error) {
	if m.err != nil {
		return 0, m.err
	}
	id := fmt.Sprintf("%s:%d", key, m.now().Truncate(window).Unix())
	m.counts[id]++
	return m.counts[id], nil
}

func testGuardConfig() config.SMSGuard {
	return config.SMSGuard{
		AllowedCountryCodes:     []string{"1"},
		DailyCap:                300,
		PhoneCooldownSeconds:    30,
		PhonePerHour:            5,
		PhonePerDay:             10,
		IPPerHour:               10,
		IPPerDay:                30,
		VerifyAttemptsPerWindow: 10,
	}
}

func newTestGuard(cfg config.SMSGuard) (*smsGuard, *memCounterStore, *time.Time) {
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	store := newMemCounterStore(func() time.Time { return now })
	return newSMSGuard(store, cfg), store, &now
}

func TestSMSPhonePolicy(t *testing.T) {
	allowed := []string{"1"}
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"+12342342345", "+12342342345", true},
		{"(234) 234-2345", "+12342342345", true},
		{"+14165551234", "+14165551234", true}, // Toronto
		{"+18765551234", "", false},            // Jamaica shares +1
		{"+18095551234", "", false},            // Dominican Republic
		{"+447700900123", "", false},           // UK
		{"+11234567890", "", false},            // area code can't start with 1
		{"+12341234567", "", false},            // exchange can't start with 1
		{"+1234", "", false},
		{"not a number", "", false},
	}
	for _, c := range cases {
		got, err := smsPhonePolicy(c.in, allowed)
		if c.ok {
			assert.NoError(t, err, c.in)
			assert.Equal(t, c.want, got, c.in)
		} else {
			assert.ErrorIs(t, err, errSMSUnsupportedNumber, c.in)
		}
	}
}

func TestSMSGuard_PhoneCooldown(t *testing.T) {
	g, _, now := newTestGuard(testGuardConfig())
	ctx := context.Background()

	_, err := g.AllowSend(ctx, "+12342342345", "1.1.1.1")
	require.NoError(t, err)
	_, err = g.AllowSend(ctx, "+12342342345", "1.1.1.1")
	assert.ErrorIs(t, err, errSMSRateLimited, "second send inside the cooldown")

	*now = now.Add(31 * time.Second)
	_, err = g.AllowSend(ctx, "+12342342345", "1.1.1.1")
	assert.NoError(t, err)
}

func TestSMSGuard_PhoneHourlyLimit(t *testing.T) {
	g, _, now := newTestGuard(testGuardConfig())
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		_, err := g.AllowSend(ctx, "+12342342345", fmt.Sprintf("10.0.0.%d", i))
		require.NoError(t, err, "send %d", i+1)
		*now = now.Add(31 * time.Second)
	}
	_, err := g.AllowSend(ctx, "+12342342345", "10.0.0.99")
	assert.ErrorIs(t, err, errSMSRateLimited, "6th send in the hour, even from a new IP")
}

func TestSMSGuard_IPLimitAcrossNumbers(t *testing.T) {
	g, _, _ := newTestGuard(testGuardConfig())
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		_, err := g.AllowSend(ctx, fmt.Sprintf("+1234234%04d", 2000+i), "6.6.6.6")
		require.NoError(t, err, "send %d", i+1)
	}
	_, err := g.AllowSend(ctx, "+12342349999", "6.6.6.6")
	assert.ErrorIs(t, err, errSMSRateLimited, "11th number from one IP in an hour")

	_, err = g.AllowSend(ctx, "+12342348888", "7.7.7.7")
	assert.NoError(t, err, "other IPs are unaffected")
}

func TestSMSGuard_DailyCap(t *testing.T) {
	cfg := testGuardConfig()
	cfg.DailyCap = 3
	g, _, _ := newTestGuard(cfg)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		_, err := g.AllowSend(ctx, fmt.Sprintf("+1234234%04d", 3000+i), fmt.Sprintf("10.1.0.%d", i))
		require.NoError(t, err)
	}
	_, err := g.AllowSend(ctx, "+12342348888", "10.1.0.50")
	assert.ErrorIs(t, err, errSMSDailyCap)
}

func TestSMSGuard_RejectedNumbersDontSpendBudget(t *testing.T) {
	cfg := testGuardConfig()
	cfg.DailyCap = 1
	g, _, _ := newTestGuard(cfg)
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		_, err := g.AllowSend(ctx, "+18765551234", "10.2.0.1")
		assert.ErrorIs(t, err, errSMSUnsupportedNumber)
	}
	_, err := g.AllowSend(ctx, "+12342342345", "10.2.0.2")
	assert.NoError(t, err, "blocked numbers must not consume the daily cap")
}

func TestSMSGuard_VerifyAttempts(t *testing.T) {
	g, _, now := newTestGuard(testGuardConfig())
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		require.NoError(t, g.AllowVerify(ctx, "+12342342345"))
	}
	assert.ErrorIs(t, g.AllowVerify(ctx, "+12342342345"), errSMSRateLimited)

	*now = now.Add(verifyWindow)
	assert.NoError(t, g.AllowVerify(ctx, "+12342342345"))
}

func TestSMSGuard_FailsClosedOnStoreError(t *testing.T) {
	g, store, _ := newTestGuard(testGuardConfig())
	store.err = errors.New("mongo down")

	_, err := g.AllowSend(context.Background(), "+12342342345", "1.1.1.1")
	require.Error(t, err)
	assert.NotErrorIs(t, err, errSMSRateLimited)
	assert.NotErrorIs(t, err, errSMSUnsupportedNumber)
}
