import { describe, expect, it } from "vitest";
import type { CategoryDocument, TaskDocument } from "@/hooks/useWorkspaces";
import { EMPTY_FILTERS, type FilterState } from "@/lib/taskFilters";
import { orderWorkspaceCategories } from "./workspaceCategories";

const task = (id: string, extra: Partial<TaskDocument> = {}) => ({ id, content: id, priority: 1, ...extra }) as TaskDocument;
const cat = (id: string, name: string, tasks: TaskDocument[]) => ({ id, name, tasks }) as CategoryDocument;

describe("orderWorkspaceCategories", () => {
  it("excludes proxy and upcoming categories from the ordered list", () => {
    const upcoming = cat("upcoming-Home", "Upcoming", [task("p", { isPhantom: true })]);
    const { categories, upcoming: pinned } = orderWorkspaceCategories(
      [cat("x", "!-proxy-!", []), upcoming, cat("a", "Alpha", [task("1")])],
      null,
      EMPTY_FILTERS,
    );
    expect(categories.map((c) => c.id)).toEqual(["a"]);
    expect(pinned?.id).toBe("upcoming-Home");
  });

  it("defaults to task count descending with a name tiebreak", () => {
    const { categories } = orderWorkspaceCategories(
      [cat("z", "Zed", [task("1")]), cat("b", "Beta", [task("2"), task("3")]), cat("a", "Alpha", [task("4")])],
      null,
      EMPTY_FILTERS,
    );
    expect(categories.map((c) => c.name)).toEqual(["Beta", "Alpha", "Zed"]);
  });

  it("orders by unfiltered counts, then filters each category", () => {
    const filters: FilterState = { ...EMPTY_FILTERS, priorities: { low: false, medium: false, high: true } };
    const { categories } = orderWorkspaceCategories(
      [
        cat("few", "Few", [task("h", { priority: 3 })]),
        cat("many", "Many", [task("l1", { priority: 1 }), task("l2", { priority: 1 })]),
      ],
      null,
      filters,
    );
    expect(categories.map((c) => c.id)).toEqual(["many", "few"]);
    expect(categories[0].tasks).toEqual([]);
    expect(categories[1].tasks.map((t) => t.id)).toEqual(["h"]);
  });

  it("applies an explicit sort", () => {
    const { categories } = orderWorkspaceCategories(
      [cat("b", "Beta", [task("1"), task("2")]), cat("a", "Alpha", [task("3")])],
      { option: "alphabetical", direction: "ascending" },
      EMPTY_FILTERS,
    );
    expect(categories.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
  });
});
