import {
    buildTagAggregates,
    selectedTagTemplateIds,
    TagAggregate,
    TemplateLike,
    CategoryLike,
} from "@/utils/tagBreakdown";

const cat = (id: string, tags: string[]): CategoryLike => ({ id, tags });

const tmpl = (
    id: string,
    categoryID: string,
    timesCompleted = 0,
): TemplateLike => ({ id, categoryID, timesCompleted });

describe("buildTagAggregates", () => {
    it("sums timesCompleted per tag across templates in matching categories", () => {
        const categories = [cat("c1", ["fitness"]), cat("c2", ["fitness", "work"])];
        const templates = [
            tmpl("t1", "c1", 10),
            tmpl("t2", "c2", 5),
            tmpl("t3", "c2", 2),
        ];
        const result = buildTagAggregates(templates, categories);
        expect(result).toEqual<TagAggregate[]>([
            { tag: "fitness", count: 17 },
            { tag: "work", count: 7 },
        ]);
    });

    it("includes zero-count tags, ranked at the bottom", () => {
        const categories = [cat("c1", ["fitness"]), cat("c2", ["idle"])];
        const templates = [tmpl("t1", "c1", 4)];
        const result = buildTagAggregates(templates, categories);
        expect(result).toEqual<TagAggregate[]>([
            { tag: "fitness", count: 4 },
            { tag: "idle", count: 0 },
        ]);
    });

    it("dedupes a tag that appears on multiple categories into one entry", () => {
        const categories = [cat("c1", ["health"]), cat("c2", ["health"])];
        const templates = [tmpl("t1", "c1", 3), tmpl("t2", "c2", 4)];
        const result = buildTagAggregates(templates, categories);
        expect(result).toEqual<TagAggregate[]>([{ tag: "health", count: 7 }]);
    });

    it("breaks count ties alphabetically", () => {
        const categories = [cat("c1", ["zebra"]), cat("c2", ["apple"])];
        const templates = [tmpl("t1", "c1", 5), tmpl("t2", "c2", 5)];
        const result = buildTagAggregates(templates, categories);
        expect(result.map((r) => r.tag)).toEqual(["apple", "zebra"]);
    });

    it("ignores templates whose category is missing or untagged", () => {
        const categories = [cat("c1", ["fitness"]), cat("c2", [])];
        const templates = [
            tmpl("t1", "c1", 4),
            tmpl("t2", "c2", 9),
            tmpl("t3", "gone", 9),
        ];
        const result = buildTagAggregates(templates, categories);
        expect(result).toEqual<TagAggregate[]>([{ tag: "fitness", count: 4 }]);
    });

    it("treats a missing timesCompleted as zero", () => {
        const categories = [cat("c1", ["fitness"])];
        const templates = [{ id: "t1", categoryID: "c1" } as TemplateLike];
        const result = buildTagAggregates(templates, categories);
        expect(result).toEqual<TagAggregate[]>([{ tag: "fitness", count: 0 }]);
    });
});

describe("selectedTagTemplateIds", () => {
    it("returns template IDs whose category carries any selected tag", () => {
        const categories = [cat("c1", ["fitness"]), cat("c2", ["work"])];
        const templates = [tmpl("t1", "c1"), tmpl("t2", "c2"), tmpl("t3", "c1")];
        const result = selectedTagTemplateIds(["fitness"], templates, categories);
        expect(result.sort()).toEqual(["t1", "t3"]);
    });

    it("unions templates across multiple selected tags without duplicates", () => {
        const categories = [cat("c1", ["fitness", "work"]), cat("c2", ["work"])];
        const templates = [tmpl("t1", "c1"), tmpl("t2", "c2")];
        const result = selectedTagTemplateIds(["fitness", "work"], templates, categories);
        expect(result.sort()).toEqual(["t1", "t2"]);
    });

    it("returns an empty array when no tags are selected", () => {
        const categories = [cat("c1", ["fitness"])];
        const templates = [tmpl("t1", "c1")];
        expect(selectedTagTemplateIds([], templates, categories)).toEqual([]);
    });
});
