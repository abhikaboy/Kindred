package xutils

import (
	"crypto/rand"

	"go.mongodb.org/mongo-driver/bson"
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
