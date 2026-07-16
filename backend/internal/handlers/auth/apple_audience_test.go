package auth

import "testing"

func TestIsAllowedAudience(t *testing.T) {
	cases := []struct {
		name    string
		aud     string
		allowed []string
		want    bool
	}{
		{"none configured skips check", "anything", []string{"", ""}, true},
		{"matches bundle id", "com.app.bundle", []string{"com.app.bundle", "com.app.web"}, true},
		{"matches service id (web)", "com.app.web", []string{"com.app.bundle", "com.app.web"}, true},
		{"no match rejected", "evil.com", []string{"com.app.bundle", "com.app.web"}, false},
		{"empties ignored, still enforced", "evil.com", []string{"", "com.app.web"}, false},
	}
	for _, c := range cases {
		if got := isAllowedAudience(c.aud, c.allowed); got != c.want {
			t.Errorf("%s: isAllowedAudience(%q, %v) = %v, want %v", c.name, c.aud, c.allowed, got, c.want)
		}
	}
}
