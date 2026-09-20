package contacts

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// MaxLinksPerSync bounds how many hashes one sync call may write. The API caps
// the request body too; this is the defence for the service if it is ever
// called from somewhere else.
const MaxLinksPerSync = 1000

// MaxNotifiedPerJoin caps the fan-out when a new user joins. Someone with a
// 5,000-entry address book would otherwise trigger thousands of pushes in one
// burst; we notify the oldest links first on the theory that a long-standing
// contact is a stronger signal than one added yesterday.
const MaxNotifiedPerJoin = 50

// ContactLinkDocument records that `owner_id` has a phone number matching
// `phone_hash` somewhere in their address book. The raw number never reaches
// the server — the client normalizes to E.164 and hashes locally — so this
// collection holds no readable contact details for people who have not signed
// up.
type ContactLinkDocument struct {
	ID        primitive.ObjectID `bson:"_id" json:"_id"`
	OwnerID   primitive.ObjectID `bson:"owner_id" json:"owner_id"`
	PhoneHash string             `bson:"phone_hash" json:"phone_hash"`
	CreatedAt primitive.DateTime `bson:"created_at" json:"created_at"`
	// NotifiedAt is stamped once we have told the owner that this contact
	// joined, so a user who re-links their number later does not re-notify
	// everybody.
	NotifiedAt *primitive.DateTime `bson:"notified_at,omitempty" json:"notified_at,omitempty"`
}

// UserMatch is a user found via contact matching. It echoes back the phone hash
// that matched so the client can label the row with the local contact's name
// without the server ever knowing that name.
type UserMatch struct {
	ID             string `json:"_id" example:"507f1f77bcf86cd799439011" doc:"User ID"`
	DisplayName    string `json:"display_name" example:"John Doe" doc:"User display name"`
	Handle         string `json:"handle" example:"johndoe" doc:"User handle"`
	ProfilePicture string `json:"profile_picture" example:"https://example.com/avatar.jpg" doc:"Profile picture URL"`
	PhoneHash      string `json:"phone_hash" doc:"Hash of the contact number that matched this user"`
}

type userMatchInternal struct {
	ID             primitive.ObjectID `bson:"_id"`
	DisplayName    string             `bson:"display_name"`
	Handle         string             `bson:"handle"`
	ProfilePicture string             `bson:"profile_picture"`
	PhoneHash      string             `bson:"phone_hash"`
}

func (u *userMatchInternal) toAPI() UserMatch {
	return UserMatch{
		ID:             u.ID.Hex(),
		DisplayName:    u.DisplayName,
		Handle:         u.Handle,
		ProfilePicture: u.ProfilePicture,
		PhoneHash:      u.PhoneHash,
	}
}

type Service struct {
	Links         *mongo.Collection
	Users         *mongo.Collection
	Connections   *mongo.Collection
	Notifications *mongo.Collection
}
