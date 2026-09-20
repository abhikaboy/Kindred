import { describe, expect, it } from "vitest";
import { extractLinksFromNotes, normalizeLink, syncNotesLinks, type TaskLink } from "./taskLinks";

const urls = (links: TaskLink[]) => links.map((l) => l.url);

describe("extractLinksFromNotes", () => {
  it.each([
    ["no urls", "just a plain note", []],
    ["a plain url", "spec is at https://example.com/spec", ["https://example.com/spec"]],
    ["a trailing period", "see https://example.com/a.", ["https://example.com/a"]],
    ["a url in parens", "(see https://example.com/a)", ["https://example.com/a"]],
    ["a bare www host", "www.example.com is the site", ["https://www.example.com"]],
    ["multiple urls", "a https://one.com b http://two.com", ["https://one.com", "http://two.com"]],
    ["a repeated url", "https://one.com and https://one.com/", ["https://one.com"]],
    ["an email address", "email me at me@example.com", []],
  ])("handles %s", (_name, notes, expected) => {
    expect(urls(extractLinksFromNotes(notes as string))).toEqual(expected);
  });

  it("titles a link with its host and marks it as notes-derived", () => {
    expect(extractLinksFromNotes("https://www.GitHub.com/abhikaboy/Kindred/pull/1")).toEqual([
      { url: "https://www.GitHub.com/abhikaboy/Kindred/pull/1", title: "github.com", source: "notes" },
    ]);
  });
});

describe("syncNotesLinks", () => {
  it("keeps manual links and replaces the notes-derived ones", () => {
    const existing: TaskLink[] = [
      { url: "https://manual.com/doc", title: "Design doc", source: "manual" },
      { url: "https://old.com", title: "old.com", source: "notes" },
    ];

    expect(urls(syncNotesLinks(existing, "now pointing at https://new.com instead"))).toEqual([
      "https://manual.com/doc",
      "https://new.com",
    ]);
  });

  it("does not duplicate a url that is already attached manually", () => {
    const existing: TaskLink[] = [{ url: "https://manual.com/doc", title: "Design doc", source: "manual" }];

    expect(syncNotesLinks(existing, "reminder: https://manual.com/doc")).toEqual(existing);
  });

  it("returns an empty list when the notes have no urls", () => {
    expect(syncNotesLinks(null, "no urls here")).toEqual([]);
  });
});

describe("normalizeLink", () => {
  it("adds a scheme and falls back to the host as the title", () => {
    expect(normalizeLink("example.com/path")).toEqual({
      url: "https://example.com/path",
      title: "example.com",
      source: "manual",
    });
  });

  it("keeps a custom title", () => {
    expect(normalizeLink("https://example.com", "Spec")?.title).toBe("Spec");
  });

  it("rejects blank input", () => {
    expect(normalizeLink("   ")).toBeNull();
  });
});
