import {
    formatConnectionCode,
    isExpired,
    lastUsedLabel,
    parseConnectionCode,
    scopeSummary,
    scopesToApprove,
    summarizeUserAgent,
    timeAgo,
} from "@/utils/assistantConnections";

describe("formatConnectionCode", () => {
    it.each([
        ["", ""],
        ["a", "A"],
        ["abcd", "ABCD"],
        ["abcde", "ABCD-E"],
        ["abcd1234", "ABCD-1234"],
        ["ABCD-1234", "ABCD-1234"],
        ["abcd 1234", "ABCD-1234"],
        ["ab-cd-12-34", "ABCD-1234"],
        ["abcd12345678", "ABCD-1234"],
        ["ab!cd#12", "ABCD-12"],
    ])("%j -> %j", (input, out) => {
        expect(formatConnectionCode(input)).toBe(out);
    });

    it("is stable when re-applied to its own output (typing after the dash)", () => {
        let value = "";
        for (const ch of "wxyz9876") value = formatConnectionCode(value + ch);
        expect(value).toBe("WXYZ-9876");
    });

    it("lets backspace remove the dash", () => {
        expect(formatConnectionCode("ABCD-")).toBe("ABCD");
    });
});

describe("parseConnectionCode", () => {
    it("accepts a code with or without the dash, in any case", () => {
        expect(parseConnectionCode("abcd1234")).toBe("ABCD-1234");
        expect(parseConnectionCode("ABCD-1234")).toBe("ABCD-1234");
        expect(parseConnectionCode(" abcd-1234 ")).toBe("ABCD-1234");
    });

    it("rejects incomplete or overlong codes", () => {
        expect(parseConnectionCode("ABCD-123")).toBeNull();
        expect(parseConnectionCode("ABCD-12345")).toBeNull();
        expect(parseConnectionCode("")).toBeNull();
    });
});

describe("summarizeUserAgent", () => {
    const cases: [string, string][] = [
        [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "Chrome on macOS",
        ],
        [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            "Safari on macOS",
        ],
        [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
            "Edge on Windows",
        ],
        ["Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "Firefox on Linux"],
        [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            "Safari on iOS",
        ],
        [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1",
            "Chrome on iOS",
        ],
        [
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
            "Chrome on Android",
        ],
        [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
            "Opera on macOS",
        ],
        [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/0.9.0 Chrome/128.0.0.0 Electron/32.0.0 Safari/537.36",
            "Desktop app on macOS",
        ],
        [
            "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "Chrome on ChromeOS",
        ],
        ["curl/8.4.0", "curl"],
        ["Mozilla/5.0 (Windows NT 10.0) SomethingElse/1.0", "A browser on Windows"],
        ["", "Unknown browser"],
        ["gibberish", "Unknown browser"],
    ];
    it.each(cases)("%s", (ua, out) => {
        expect(summarizeUserAgent(ua)).toBe(out);
    });

    it("handles a missing user agent", () => {
        expect(summarizeUserAgent(undefined)).toBe("Unknown browser");
        expect(summarizeUserAgent(null)).toBe("Unknown browser");
    });
});

describe("timeAgo and lastUsedLabel", () => {
    const now = new Date(2026, 8, 30, 12, 0);
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

    it.each([
        [0, "just now"],
        [1, "a minute ago"],
        [5, "5 minutes ago"],
        [60, "an hour ago"],
        [180, "3 hours ago"],
        [60 * 24, "yesterday"],
        [60 * 24 * 3, "3 days ago"],
    ])("%i minutes", (m, out) => {
        expect(timeAgo(minutesAgo(m), now)).toBe(out);
    });

    it("is null for missing or bad input", () => {
        expect(timeAgo(null, now)).toBeNull();
        expect(timeAgo("not a date", now)).toBeNull();
    });

    it("labels never-used connections", () => {
        expect(lastUsedLabel(null, now)).toBe("Not used yet");
        expect(lastUsedLabel(minutesAgo(5), now)).toBe("Used 5 minutes ago");
    });
});

describe("scopes", () => {
    const requested = [{ id: "kindred:read" }, { id: "kindred:write" }, { id: "kindred:complete" }];

    it("sends everything requested by default", () => {
        expect(scopesToApprove(requested, {})).toEqual(["kindred:read", "kindred:write", "kindred:complete"]);
    });

    it("drops switched-off scopes but never read", () => {
        expect(scopesToApprove(requested, { "kindred:write": false })).toEqual(["kindred:read", "kindred:complete"]);
        expect(scopesToApprove(requested, { "kindred:read": false, "kindred:complete": false })).toEqual([
            "kindred:read",
            "kindred:write",
        ]);
    });

    it("summarizes scopes for list rows", () => {
        expect(scopeSummary([{ id: "kindred:read", title: "Read" }, "kindred:write", "kindred:complete"])).toBe(
            "Read, edit, complete"
        );
        expect(scopeSummary([])).toBeNull();
        expect(scopeSummary(undefined)).toBeNull();
    });
});

describe("isExpired", () => {
    const now = new Date(2026, 8, 30, 12, 0);
    it("compares against now", () => {
        expect(isExpired(new Date(now.getTime() - 1000).toISOString(), now)).toBe(true);
        expect(isExpired(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(false);
        expect(isExpired(undefined, now)).toBe(false);
    });
});
