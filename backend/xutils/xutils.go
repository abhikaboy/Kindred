package xutils

import (
	"crypto/rand"
	"fmt"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GenerateOTP(length int) (string, error) {

	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

	otp := make([]byte, length)
	randomBytes := make([]byte, length)

	// Generate random bytes in a single call.
	_, err := rand.Read(randomBytes)
	if err != nil {
		return "", err
	}

	for i, b := range randomBytes {
		otp[i] = chars[b%byte(len(chars))]
	}

	return string(otp), nil
}

func ToDoc(v interface{}) (doc *bson.D, err error) {
	data, err := bson.Marshal(v)
	if err != nil {
		return
	}
	err = bson.Unmarshal(data, &doc)
	return
}

func ParseIDs(c *fiber.Ctx, ids ...string) (error, []primitive.ObjectID) {
	var err error
	var ids_ []primitive.ObjectID

	fmt.Println(ids)

	for index, id := range ids {
		id_, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			slog.LogAttrs(c.Context(), slog.LevelError, "Error Parsing IDs at "+string(index), slog.String("error", err.Error()), slog.String("id", id))
			return err, nil
		}
		ids_ = append(ids_, id_)
	}
	return err, ids_
}

func ToUTC(t time.Time) time.Time {
	return t.UTC()
}

func NowUTC() time.Time {
	return time.Now().UTC()
}

func ParseTimeToUTC(t time.Time) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, t.Format(time.RFC3339))
	if err != nil {
		return time.Time{}, err
	}
	return t, nil
}
