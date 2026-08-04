import type { CategoryDocument, TaskDocument } from "@/hooks/useWorkspaces";
import type { components } from "@/lib/api/types.gen";

type TemplateWithCategory = components["schemas"]["TemplateWithCategory"];

// Mirrors frontend/utils/phantomTasks.ts: a client-side placeholder task,
// rendered dimmed, for a recurring template that hasn't generated its next
// active instance yet.
export function computePhantomTasks(
  templates: TemplateWithCategory[],
  categories: CategoryDocument[]
): Map<string, TaskDocument[]> {
  const activeTemplateIds = new Set<string>();
  for (const cat of categories) {
    for (const task of cat.tasks ?? []) {
      if (task.active !== false && task.templateID) {
        activeTemplateIds.add(task.templateID);
      }
    }
  }

  const map = new Map<string, TaskDocument[]>();
  const now = new Date().toISOString();

  for (const tpl of templates) {
    if (activeTemplateIds.has(tpl.id) || !tpl.nextGenerated) continue;

    const phantom: TaskDocument = {
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
      posted: false,
      isPhantom: true,
      startDate: tpl.nextGenerated,
      timestamp: now,
      lastEdited: now,
    };

    const list = map.get(tpl.categoryID);
    if (list) list.push(phantom);
    else map.set(tpl.categoryID, [phantom]);
  }

  return map;
}
