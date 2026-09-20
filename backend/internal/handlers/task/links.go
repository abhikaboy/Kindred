package task

import (
	"net/url"
	"regexp"
	"strings"
)

// Link sources. Links extracted from notes are re-derived every time notes
// change, so a URL removed from the notes disappears from the list. Links the
// user attached explicitly are never touched by that sync.
const (
	LinkSourceNotes  = "notes"
	LinkSourceManual = "manual"
)

// urlPattern matches bare http(s) URLs and www-prefixed hosts. The character
// class deliberately excludes brackets and quotes so a URL inside markdown or
// prose doesn't swallow the surrounding punctuation.
var urlPattern = regexp.MustCompile(`(?i)\b(?:https?://|www\.)[^\s<>()\[\]{}"']+`)

// trailingPunctuation is stripped from the end of a match: notes are prose, so
// "see https://example.com." should not yield a URL ending in a period.
const trailingPunctuation = `.,;:!?'"`

// ExtractLinksFromNotes pulls every URL out of a notes body, in the order it
// appears, deduplicated by normalized URL.
func ExtractLinksFromNotes(notes string) []TaskLink {
	matches := urlPattern.FindAllString(notes, -1)
	links := make([]TaskLink, 0, len(matches))
	seen := make(map[string]bool, len(matches))

	for _, match := range matches {
		raw := strings.TrimRight(match, trailingPunctuation)
		// An unbalanced closing paren is far more likely to be prose than part
		// of the URL, e.g. "(see https://example.com/a)".
		if strings.Count(raw, "(") < strings.Count(raw, ")") {
			raw = strings.TrimRight(raw, ")")
		}
		if raw == "" {
			continue
		}
		if !strings.Contains(raw, "://") {
			raw = "https://" + raw
		}

		parsed, err := url.Parse(raw)
		if err != nil || parsed.Host == "" {
			continue
		}

		key := normalizeLinkKey(parsed)
		if seen[key] {
			continue
		}
		seen[key] = true

		links = append(links, TaskLink{
			URL:    raw,
			Title:  strings.TrimPrefix(strings.ToLower(parsed.Host), "www."),
			Source: LinkSourceNotes,
		})
	}

	return links
}

// normalizeLinkKey builds the dedupe key: host and scheme are case-insensitive,
// the rest of the URL is not.
func normalizeLinkKey(u *url.URL) string {
	normalized := *u
	normalized.Scheme = strings.ToLower(normalized.Scheme)
	normalized.Host = strings.ToLower(normalized.Host)
	return strings.TrimSuffix(normalized.String(), "/")
}

// SyncNotesLinks returns the link list for a task whose notes just changed:
// every manually attached link is kept as-is, and the notes-derived links are
// replaced wholesale by what the new notes contain. A URL that the user had
// already attached manually wins, so re-typing it in the notes doesn't produce
// a duplicate row.
func SyncNotesLinks(existing []TaskLink, notes string) []TaskLink {
	manual := make([]TaskLink, 0, len(existing))
	manualKeys := make(map[string]bool, len(existing))
	for _, link := range existing {
		if link.Source == LinkSourceNotes {
			continue
		}
		manual = append(manual, link)
		if parsed, err := url.Parse(link.URL); err == nil && parsed.Host != "" {
			manualKeys[normalizeLinkKey(parsed)] = true
		}
	}

	synced := manual
	for _, link := range ExtractLinksFromNotes(notes) {
		parsed, err := url.Parse(link.URL)
		if err != nil || manualKeys[normalizeLinkKey(parsed)] {
			continue
		}
		synced = append(synced, link)
	}

	if len(synced) == 0 {
		return nil
	}
	return synced
}

// NormalizeLinks cleans a client-supplied link list: blank URLs are dropped,
// a missing scheme becomes https, an empty title falls back to the host, and an
// unset source is treated as manual so the notes sync won't later delete it.
func NormalizeLinks(links []TaskLink) []TaskLink {
	normalized := make([]TaskLink, 0, len(links))
	seen := make(map[string]bool, len(links))

	for _, link := range links {
		raw := strings.TrimSpace(link.URL)
		if raw == "" {
			continue
		}
		if !strings.Contains(raw, "://") {
			raw = "https://" + raw
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Host == "" {
			continue
		}

		key := normalizeLinkKey(parsed)
		if seen[key] {
			continue
		}
		seen[key] = true

		link.URL = raw
		if strings.TrimSpace(link.Title) == "" {
			link.Title = strings.TrimPrefix(strings.ToLower(parsed.Host), "www.")
		}
		if link.Source != LinkSourceNotes {
			link.Source = LinkSourceManual
		}
		normalized = append(normalized, link)
	}

	if len(normalized) == 0 {
		return nil
	}
	return normalized
}
