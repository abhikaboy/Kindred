import { describe, expect, it } from "vitest";
import { tagPayload, type TaggedUser } from "./tags";

const u = (id: string, status: string): TaggedUser => ({
  id,
  status,
  handle: `@${id}`,
  display_name: id,
  profile_picture: "",
});

describe("tagPayload", () => {
  it("keeps locked (non-pending) users even if not re-selected", () => {
    const current = [u("a", "watching"), u("b", "copied"), u("c", "untagged")];
    expect(tagPayload(current, []).sort()).toEqual(["a", "b", "c"]);
  });

  it("drops pending users that are no longer selected", () => {
    const current = [u("a", "pending"), u("b", "pending")];
    expect(tagPayload(current, ["a"])).toEqual(["a"]);
  });

  it("adds newly selected users", () => {
    const current = [u("a", "pending")];
    expect(tagPayload(current, ["a", "b"]).sort()).toEqual(["a", "b"]);
  });

  it("dedupes when a selected id is also locked", () => {
    const current = [u("a", "watching")];
    expect(tagPayload(current, ["a"])).toEqual(["a"]);
  });

  it("merges locked + selected", () => {
    const current = [u("a", "watching"), u("b", "pending")];
    expect(tagPayload(current, ["c"]).sort()).toEqual(["a", "c"]);
  });
});
