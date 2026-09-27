import type { Workspace } from "@/api/types";

export type CategoryOption = { id: string; name: string; workspace: string };

// Placeholder category the backend keeps in otherwise empty workspaces
const PROXY = "!-proxy-!";

/** Every category a task can be filed into, in workspace order. Blueprints are excluded. */
export function listCategories(workspaces: Workspace[] | undefined): CategoryOption[] {
    const out: CategoryOption[] = [];
    for (const ws of workspaces ?? []) {
        if (ws.isBlueprint) continue;
        for (const c of ws.categories ?? []) {
            if (c.name === PROXY) continue;
            out.push({ id: c.id, name: c.name, workspace: ws.name });
        }
    }
    return out;
}

// "#sideproj" should find "Side Projects": compare without case or spaces.
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function score(option: CategoryOption, q: string): number {
    const name = squash(option.name);
    if (name === q) return 4;
    if (name.startsWith(q)) return 3;
    if (option.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 1;
    return 0;
}

/**
 * Matches for `query`, best first. Ties go to the suggested category, then the
 * workspace being viewed, then workspace order. An empty query matches all.
 */
export function rankCategories(
    options: CategoryOption[],
    query: string,
    { suggestedId, workspace }: { suggestedId?: string; workspace?: string } = {}
): CategoryOption[] {
    const q = squash(query);
    return options
        .map((option, index) => ({
            option,
            index,
            score: q ? score(option, q) : 1,
            bias: (option.id === suggestedId ? 2 : 0) + (option.workspace === workspace ? 1 : 0),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || b.bias - a.bias || a.index - b.index)
        .map((r) => r.option);
}

/** True when `query` names an existing category in `workspace` exactly (ignoring case and spaces). */
export function hasExactMatch(options: CategoryOption[], query: string, workspace: string): boolean {
    const q = squash(query);
    return options.some((o) => o.workspace === workspace && squash(o.name) === q);
}
