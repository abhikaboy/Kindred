import type { components } from "@/lib/api/types.gen";

type ProfileDocument = components["schemas"]["ProfileDocument"];

export type Reco =
    | { kind: "task"; label: string; task: { id: string; content: string; categoryId: string } }
    | { kind: "ring"; label: string }
    | { kind: "profile"; label: string };

// Present-tense "what they're doing": public task, then open rings, then fallback.
export function deriveReco(profile: ProfileDocument | undefined): Reco {
    const tasks = profile?.tasks ?? [];
    const task =
        tasks.find((t) => t.public && t.workingOnSince) ??
        tasks.find((t) => t.public && t.active);
    if (task) {
        return {
            kind: "task",
            label: 'Working on "' + task.content + '"',
            task: { id: task.id, content: task.content, categoryId: task.categoryID ?? "" },
        };
    }

    const rings = profile?.ring_state;
    if (rings) {
        const open = [rings.plan, rings.do, rings.share].filter((r) => !r.closed).length;
        if (open > 0) {
            return { kind: "ring", label: open + " ring" + (open === 1 ? "" : "s") + " left today" };
        }
    }

    return { kind: "profile", label: "Brighten their day" };
}
