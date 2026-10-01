package oauth

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	minMetadataCacheTTL = 5 * time.Minute
	maxMetadataCacheTTL = 24 * time.Hour
)

// FetchPolicy controls how client metadata documents are fetched.
type FetchPolicy struct {
	// AllowPrivateNetworks permits IP literals and private/loopback targets. Tests only.
	AllowPrivateNetworks bool
	RootCAs              *x509.CertPool
	Timeout              time.Duration
	MaxBytes             int64
}

func DefaultFetchPolicy() FetchPolicy {
	return FetchPolicy{Timeout: 5 * time.Second, MaxBytes: 16 << 10}
}

var errBlockedAddress = errors.New("destination address is not allowed")

type metadataFetcher struct {
	policy FetchPolicy
	client *http.Client
}

func newMetadataFetcher(p FetchPolicy) *metadataFetcher {
	if p.Timeout <= 0 {
		p.Timeout = 5 * time.Second
	}
	if p.MaxBytes <= 0 {
		p.MaxBytes = 16 << 10
	}
	dialer := &net.Dialer{Timeout: p.Timeout}
	if !p.AllowPrivateNetworks {
		// Control runs after DNS resolution, so rebinding to an internal address is caught too.
		dialer.Control = func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return errBlockedAddress
			}
			addr, err := netip.ParseAddr(host)
			if err != nil || blockedAddr(addr) {
				return errBlockedAddress
			}
			return nil
		}
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: p.RootCAs},
		TLSHandshakeTimeout:   p.Timeout,
		ResponseHeaderTimeout: p.Timeout,
		MaxIdleConns:          10,
		IdleConnTimeout:       30 * time.Second,
		ForceAttemptHTTP2:     true,
	}
	return &metadataFetcher{
		policy: p,
		client: &http.Client{
			Transport: transport,
			Timeout:   p.Timeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

var extraBlockedPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"),
	netip.MustParsePrefix("2001:db8::/32"),
}

func blockedAddr(addr netip.Addr) bool {
	addr = addr.Unmap()
	if !addr.IsValid() || addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast() ||
		addr.IsLinkLocalMulticast() || addr.IsInterfaceLocalMulticast() || addr.IsMulticast() || addr.IsUnspecified() {
		return true
	}
	for _, p := range extraBlockedPrefixes {
		if p.Contains(addr) {
			return true
		}
	}
	return false
}

// checkFetchURL applies the static URL rules before any network access.
func (f *metadataFetcher) checkFetchURL(u *url.URL) error {
	if u.Scheme != "https" {
		return errors.New("client metadata must be served over https")
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("client id has no host")
	}
	if f.policy.AllowPrivateNetworks {
		return nil
	}
	if _, err := netip.ParseAddr(host); err != nil {
		if strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".localhost") {
			return errBlockedAddress
		}
		return nil
	}
	return errors.New("client id host must be a domain name, not an IP address")
}

// fetch returns the document body and how long it may be cached.
func (f *metadataFetcher) fetch(ctx context.Context, rawURL string) ([]byte, time.Duration, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, 0, fmt.Errorf("parse client id: %w", err)
	}
	if err := f.checkFetchURL(u); err != nil {
		return nil, 0, err
	}
	ctx, cancel := context.WithTimeout(ctx, f.policy.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Kindred-OAuth/1.0")
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("fetch client metadata: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("client metadata returned status %d", resp.StatusCode)
	}
	mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return nil, 0, errors.New("client metadata must be application/json")
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, f.policy.MaxBytes+1))
	if err != nil {
		return nil, 0, fmt.Errorf("read client metadata: %w", err)
	}
	if int64(len(body)) > f.policy.MaxBytes {
		return nil, 0, errors.New("client metadata document is too large")
	}
	return body, cacheTTL(resp.Header.Get("Cache-Control")), nil
}

func cacheTTL(cacheControl string) time.Duration {
	ttl := minMetadataCacheTTL
	for _, directive := range strings.Split(cacheControl, ",") {
		k, v, _ := strings.Cut(strings.TrimSpace(strings.ToLower(directive)), "=")
		if k != "max-age" {
			continue
		}
		if secs, err := strconv.ParseInt(strings.Trim(v, `"`), 10, 64); err == nil && secs > 0 {
			ttl = time.Duration(min(secs, int64(maxMetadataCacheTTL/time.Second))) * time.Second
		}
	}
	return min(max(ttl, minMetadataCacheTTL), maxMetadataCacheTTL)
}
