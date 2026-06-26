package Post

import "testing"

// Malformed tagged-user input must be dropped, never error — a bad "@" (or any
// garbage) can't be allowed to fail a post. coerceMentions keeps only the
// object-shaped {id, handle} entries; the handler then ObjectID/friend-gates.
func TestCoerceMentions_DropsMalformed(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want int
	}{
		{"nil", nil, 0},
		{"not an array (string)", "@", 0},
		{"not an array (number)", 42, 0},
		{"empty array", []any{}, 0},
		{
			"mixed garbage + one valid",
			[]any{
				map[string]any{"id": "", "handle": ""},   // bare "@" with nothing picked
				map[string]any{"id": "@", "handle": "@"}, // garbage strings (kept; handler drops bad ObjectID)
				map[string]any{"id": float64(123)},       // wrong type → dropped
				"loose string",                           // not an object → dropped
				42,                                       // not an object → dropped
				map[string]any{"id": "507f1f77bcf86cd799439011", "handle": "real"},
			},
			3, // the two string-shaped objects + the valid one survive coercion
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := coerceMentions(c.in)
			if len(got) != c.want {
				t.Fatalf("coerceMentions(%v) kept %d, want %d (%v)", c.in, len(got), c.want, got)
			}
		})
	}
}
