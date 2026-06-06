export interface TagAggregate {
    tag: string;
    count: number;
}

export interface TemplateLike {
    id: string;
    categoryID: string;
    timesCompleted?: number;
}

export interface CategoryLike {
    id: string;
    tags?: string[];
}

const categoryTagsById = (
    categories: CategoryLike[],
): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const category of categories) {
        map.set(category.id, category.tags ?? []);
    }
    return map;
};

// Lifetime completion count per tag, descending; ties broken alphabetically.
// Every tag on any category is included, even with a zero count.
export const buildTagAggregates = (
    templates: TemplateLike[],
    categories: CategoryLike[],
): TagAggregate[] => {
    const tagsById = categoryTagsById(categories);

    const counts = new Map<string, number>();
    for (const tags of tagsById.values()) {
        for (const tag of tags) {
            if (!counts.has(tag)) counts.set(tag, 0);
        }
    }

    for (const template of templates) {
        const tags = tagsById.get(template.categoryID);
        if (!tags) continue;
        const completed = template.timesCompleted ?? 0;
        for (const tag of tags) {
            counts.set(tag, (counts.get(tag) ?? 0) + completed);
        }
    }

    return Array.from(counts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

// Template IDs whose category carries any of the selected tags (deduped).
export const selectedTagTemplateIds = (
    selectedTags: string[],
    templates: TemplateLike[],
    categories: CategoryLike[],
): string[] => {
    if (selectedTags.length === 0) return [];
    const selected = new Set(selectedTags);
    const tagsById = categoryTagsById(categories);

    const ids = new Set<string>();
    for (const template of templates) {
        const tags = tagsById.get(template.categoryID) ?? [];
        if (tags.some((tag) => selected.has(tag))) {
            ids.add(template.id);
        }
    }
    return Array.from(ids);
};
