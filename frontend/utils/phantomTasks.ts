import type { RecurDetails, Task, Workspace } from "@/api/types";

type TemplateLike = {
    id: string;
    categoryID: string;
    content: string;
    priority?: number;
    value?: number;
    public?: boolean;
    recurFrequency: string;
    recurType: string;
    recurDetails: RecurDetails;
    nextGenerated?: string;
};

export function computePhantomTasks(templates: TemplateLike[], workspaces: Workspace[]): Map<string, Task[]> {
    const activeTemplateIds = new Set<string>();
    for (const ws of workspaces) {
        for (const cat of ws.categories) {
            for (const task of cat.tasks) {
                if (task.active !== false && task.templateID) {
                    activeTemplateIds.add(task.templateID);
                }
            }
        }
    }

    console.log("[phantomTasks] templates:", templates.length, "activeTemplateIds:", activeTemplateIds.size);

    const map = new Map<string, Task[]>();
    const now = new Date().toISOString();

    for (const tpl of templates) {
        const hasActive = activeTemplateIds.has(tpl.id);
        console.log("[phantomTasks] template", tpl.id, "content:", tpl.content, "hasActive:", hasActive, "nextGenerated:", tpl.nextGenerated, "categoryID:", tpl.categoryID);
        if (hasActive || !tpl.nextGenerated) continue;

        const phantom: Task = {
            id: `phantom-${tpl.id}`,
            content: tpl.content,
            priority: tpl.priority ?? 0,
            value: tpl.value ?? 0,
            recurring: true,
            recurFrequency: tpl.recurFrequency,
            recurType: tpl.recurType,
            recurDetails: tpl.recurDetails,
            templateID: tpl.id,
            public: tpl.public ?? false,
            active: true,
            isPhantom: true,
            nextGenerated: tpl.nextGenerated,
            timestamp: now,
            lastEdited: now,
        };

        const list = map.get(tpl.categoryID);
        if (list) list.push(phantom);
        else map.set(tpl.categoryID, [phantom]);
    }

    return map;
}
