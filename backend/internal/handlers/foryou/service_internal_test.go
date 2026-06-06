package foryou

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestParseEntityCardID(t *testing.T) {
	oid := primitive.NewObjectID()

	t.Run("splits prefix and ObjectID", func(t *testing.T) {
		prefix, id, err := parseEntityCardID("kudos-" + oid.Hex())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if prefix != "kudos" {
			t.Fatalf("got prefix %q, want %q", prefix, "kudos")
		}
		if id != oid {
			t.Fatalf("got id %v, want %v", id, oid)
		}
	})

	t.Run("rejects ids without a valid hex suffix", func(t *testing.T) {
		if _, _, err := parseEntityCardID("kudos-not-hex"); err == nil {
			t.Fatal("expected error for non-hex suffix, got nil")
		}
	})

	t.Run("rejects ids with no prefix separator", func(t *testing.T) {
		if _, _, err := parseEntityCardID(oid.Hex()); err == nil {
			t.Fatal("expected error for missing separator, got nil")
		}
	})
}
