package task

import "testing"

func urls(links []TaskLink) []string {
	out := make([]string, 0, len(links))
	for _, l := range links {
		out = append(out, l.URL)
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestExtractLinksFromNotes(t *testing.T) {
	cases := []struct {
		name  string
		notes string
		want  []string
	}{
		{"none", "just a plain note", nil},
		{"plain url", "spec is at https://example.com/spec", []string{"https://example.com/spec"}},
		{"trailing period", "see https://example.com/a.", []string{"https://example.com/a"}},
		{"in parens", "(see https://example.com/a)", []string{"https://example.com/a"}},
		{"bare www", "www.example.com is the site", []string{"https://www.example.com"}},
		{"multiple", "a https://one.com b http://two.com", []string{"https://one.com", "http://two.com"}},
		{"dedupe", "https://one.com and https://one.com/", []string{"https://one.com"}},
		{"not a url", "email me at me@example.com", nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := urls(ExtractLinksFromNotes(tc.notes))
			if !equal(got, tc.want) {
				t.Fatalf("ExtractLinksFromNotes(%q) = %v, want %v", tc.notes, got, tc.want)
			}
		})
	}
}

func TestExtractLinksTitleIsHost(t *testing.T) {
	links := ExtractLinksFromNotes("https://www.GitHub.com/abhikaboy/Kindred/pull/1")
	if len(links) != 1 {
		t.Fatalf("expected 1 link, got %d", len(links))
	}
	if links[0].Title != "github.com" {
		t.Errorf("Title = %q, want %q", links[0].Title, "github.com")
	}
	if links[0].Source != LinkSourceNotes {
		t.Errorf("Source = %q, want %q", links[0].Source, LinkSourceNotes)
	}
}

func TestSyncNotesLinksKeepsManualAndReplacesDerived(t *testing.T) {
	existing := []TaskLink{
		{URL: "https://manual.com/doc", Title: "Design doc", Source: LinkSourceManual},
		{URL: "https://old.com", Title: "old.com", Source: LinkSourceNotes},
	}

	got := urls(SyncNotesLinks(existing, "now pointing at https://new.com instead"))
	want := []string{"https://manual.com/doc", "https://new.com"}
	if !equal(got, want) {
		t.Fatalf("SyncNotesLinks = %v, want %v", got, want)
	}
}

func TestSyncNotesLinksDoesNotDuplicateManualURL(t *testing.T) {
	existing := []TaskLink{{URL: "https://manual.com/doc", Title: "Design doc", Source: LinkSourceManual}}

	synced := SyncNotesLinks(existing, "reminder: https://manual.com/doc")
	if len(synced) != 1 {
		t.Fatalf("expected 1 link, got %d: %v", len(synced), urls(synced))
	}
	if synced[0].Title != "Design doc" || synced[0].Source != LinkSourceManual {
		t.Errorf("manual link was overwritten: %+v", synced[0])
	}
}

func TestSyncNotesLinksEmpty(t *testing.T) {
	if got := SyncNotesLinks(nil, "no urls here"); got != nil {
		t.Fatalf("expected nil, got %v", urls(got))
	}
}

func TestNormalizeLinks(t *testing.T) {
	got := NormalizeLinks([]TaskLink{
		{URL: "  "},
		{URL: "example.com/path"},
		{URL: "https://example.com/path"}, // duplicate of the above once schemed
		{URL: "https://other.com", Title: "Custom"},
	})

	if !equal(urls(got), []string{"https://example.com/path", "https://other.com"}) {
		t.Fatalf("NormalizeLinks = %v", urls(got))
	}
	if got[0].Title != "example.com" {
		t.Errorf("Title = %q, want host fallback", got[0].Title)
	}
	if got[1].Title != "Custom" {
		t.Errorf("custom title was overwritten: %q", got[1].Title)
	}
	for _, l := range got {
		if l.Source != LinkSourceManual {
			t.Errorf("Source = %q, want manual", l.Source)
		}
	}
}
