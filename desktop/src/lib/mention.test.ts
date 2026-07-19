import { describe, expect, it } from "vitest";
import { detectMention, applyMention, normalizeHandle } from "./mention";

describe("detectMention", () => {
  it("detects @ at start of text", () => {
    expect(detectMention("@al", 3)).toEqual({ query: "al", start: 0 });
  });

  it("detects @ after whitespace", () => {
    expect(detectMention("hi @be", 6)).toEqual({ query: "be", start: 3 });
  });

  it("returns empty query right after typing @", () => {
    expect(detectMention("hi @", 4)).toEqual({ query: "", start: 3 });
  });

  it("ignores @ not on a word boundary (email)", () => {
    expect(detectMention("me@x", 4)).toBeNull();
  });

  it("returns null when a space sits between @ and caret", () => {
    expect(detectMention("@al done", 8)).toBeNull();
  });

  it("returns null when there is no @", () => {
    expect(detectMention("hello world", 11)).toBeNull();
  });

  it("uses the caret, not end of text", () => {
    expect(detectMention("@al and more", 3)).toEqual({ query: "al", start: 0 });
  });
});

describe("applyMention", () => {
  it("replaces the @query span with '@handle ' and moves caret after it", () => {
    // "hi @be" with match starting at 3, caret 6, pick "@beak"
    expect(applyMention("hi @be", 3, 6, "@beak")).toEqual({ text: "hi @beak ", caret: 9 });
  });

  it("preserves text after the caret", () => {
    expect(applyMention("@be rest", 0, 3, "@beak")).toEqual({ text: "@beak  rest", caret: 6 });
  });

  it("does not double the @ when handle already has one", () => {
    expect(applyMention("@b", 0, 2, "@beak").text).toBe("@beak ");
  });

  it("adds a leading @ when the handle lacks it", () => {
    expect(applyMention("@b", 0, 2, "beak").text).toBe("@beak ");
  });
});

describe("normalizeHandle", () => {
  it("keeps a single leading @", () => {
    expect(normalizeHandle("@x")).toBe("@x");
    expect(normalizeHandle("x")).toBe("@x");
  });
});
