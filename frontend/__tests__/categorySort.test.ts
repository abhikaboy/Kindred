import { sortCategories } from "@/utils/categorySort";
import { Categories, Task } from "@/api/types";

const task = (over: Partial<Task>): Task => ({ id: "t", content: "", priority: 1, ...(over as any) });

const cat = (name: string, tasks: Partial<Task>[]): Categories => ({
    id: name,
    name,
    tags: [],
    tasks: tasks.map(task),
});

describe("sortCategories", () => {
    it("does not mutate the input array", () => {
        const input = [cat("b", []), cat("a", [])];
        const snapshot = [...input];
        sortCategories(input, "alphabetical", "ascending");
        expect(input).toEqual(snapshot);
    });

    it("sorts alphabetically in both directions", () => {
        const cats = [cat("Banana", []), cat("apple", []), cat("Cherry", [])];
        expect(sortCategories(cats, "alphabetical", "ascending").map((c) => c.name)).toEqual([
            "apple",
            "Banana",
            "Cherry",
        ]);
        expect(sortCategories(cats, "alphabetical", "descending").map((c) => c.name)).toEqual([
            "Cherry",
            "Banana",
            "apple",
        ]);
    });

    it("sorts by task count", () => {
        const cats = [
            cat("one", [{}]),
            cat("three", [{}, {}, {}]),
            cat("two", [{}, {}]),
        ];
        expect(sortCategories(cats, "task-count", "descending").map((c) => c.name)).toEqual([
            "three",
            "two",
            "one",
        ]);
        expect(sortCategories(cats, "task-count", "ascending").map((c) => c.name)).toEqual([
            "one",
            "two",
            "three",
        ]);
    });

    it("sorts by earliest due date, categories without deadlines last (ascending)", () => {
        const cats = [
            cat("none", [{ content: "x" }]),
            cat("later", [{ deadline: "2026-02-01T00:00:00Z" }]),
            cat("soon", [{ deadline: "2026-01-01T00:00:00Z" }]),
        ];
        expect(sortCategories(cats, "due-date", "ascending").map((c) => c.name)).toEqual([
            "soon",
            "later",
            "none",
        ]);
    });
});
