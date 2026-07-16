import { describe, it, expect } from "vitest";
import { isMediaUrl } from "@/lib/kudos";

describe("isMediaUrl", () => {
  it("treats http(s) URLs as media", () => {
    expect(isMediaUrl("https://media.tenor.com/x.gif")).toBe(true);
    expect(isMediaUrl("  http://cdn.example.com/a.png  ")).toBe(true);
  });
  it("treats plain text as not media", () => {
    expect(isMediaUrl("great job!")).toBe(false);
    expect(isMediaUrl("check http://x.com out")).toBe(false); // has spaces → not a bare URL
    expect(isMediaUrl("")).toBe(false);
    expect(isMediaUrl(undefined)).toBe(false);
  });
});
