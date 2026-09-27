import type { Task, Workspace } from '@/api/types';
import {
    buildNextTaskTimeline,
    buildStreakProps,
    buildTodayProps,
    buildTodayTimeline,
    buildWorkspaceProps,
    nextLocalMidnight,
    selectTodayTasks,
} from '@/widgets/widgetData';

// Sunday 2026-09-27, 14:00 local
const NOW = new Date(2026, 8, 27, 14, 0, 0).getTime();
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 8, 27 + dayOffset, h, m).toISOString();

let seq = 0;
const task = (overrides: Partial<Task> = {}): Task =>
    ({
        id: `t${++seq}`,
        content: `Task ${seq}`,
        priority: 1,
        value: 1,
        recurring: false,
        public: false,
        active: false,
        timestamp: '',
        lastEdited: '',
        categoryID: 'cat',
        workspaceName: 'Work',
        ...overrides,
    }) as Task;

describe('selectTodayTasks', () => {
    it('includes tasks due today, overdue from earlier days, and starting today', () => {
        const dueToday = task({ deadline: at(18) });
        const overdue = task({ deadline: at(9, 0, -2) });
        const startsToday = task({ startDate: at(8) });
        const tomorrow = task({ deadline: at(10, 0, 1) });
        const undated = task();
        const done = task({ deadline: at(16), timeCompleted: at(12) });

        const result = selectTodayTasks([dueToday, overdue, startsToday, tomorrow, undated, done], NOW);
        expect(result.map((t) => t.id).sort()).toEqual([dueToday.id, overdue.id, startsToday.id].sort());
    });

    it('ignores invalid dates instead of treating them as overdue', () => {
        expect(selectTodayTasks([task({ deadline: 'not a date' })], NOW)).toEqual([]);
    });
});

describe('buildTodayProps', () => {
    it('counts remaining and overdue tasks and sorts overdue first', () => {
        const later = task({ deadline: at(20) });
        const late = task({ deadline: at(9) });
        const undated = task({ startDate: at(8), priority: 3 });
        const props = buildTodayProps([later, undated, late], 4, NOW);

        expect(props.completedCount).toBe(4);
        expect(props.remainingCount).toBe(3);
        expect(props.overdueCount).toBe(1);
        expect(props.tasks.map((t) => t.id)).toEqual([late.id, later.id, undated.id]);
        expect(props.tasks[0].overdue).toBe(true);
    });

    it('caps the task list but keeps the full remaining count', () => {
        const many = Array.from({ length: 12 }, (_, i) => task({ deadline: at(15, i) }));
        const props = buildTodayProps(many, 0, NOW);
        expect(props.tasks).toHaveLength(8);
        expect(props.remainingCount).toBe(12);
    });

    it('produces payloads with no null or undefined values (UserDefaults cannot store them)', () => {
        const props = buildTodayProps([task({ deadline: at(15) }), task({ startDate: at(9), workspaceName: undefined, categoryID: undefined })], 0, NOW);
        const json = JSON.stringify(props);
        expect(json).not.toContain('null');
        expect(JSON.parse(json)).toEqual(props);
    });
});

describe('buildTodayTimeline', () => {
    it('adds an entry at each remaining deadline today and resets at midnight', () => {
        const a = task({ deadline: at(15) });
        const b = task({ deadline: at(17) });
        const timeline = buildTodayTimeline([a, b], 2, NOW);

        expect(timeline.map((e) => e.date.getTime())).toEqual([
            NOW,
            new Date(at(15)).getTime(),
            new Date(at(17)).getTime(),
            nextLocalMidnight(NOW),
        ]);
        // At 15:00 the first task has come due
        expect(timeline[1].props.overdueCount).toBe(1);
        const midnight = timeline[timeline.length - 1].props;
        expect(midnight.completedCount).toBe(0);
        expect(midnight.overdueCount).toBe(2);
    });
});

describe('buildNextTaskTimeline', () => {
    it('advances to the following deadline as each one passes', () => {
        const first = task({ deadline: at(15) });
        const second = task({ deadline: at(16) });
        const past = task({ deadline: at(9) });
        const timeline = buildNextTaskTimeline([second, past, first], NOW);

        expect(timeline[0].props.task?.id).toBe(first.id);
        expect(timeline[1].date.getTime()).toBe(new Date(at(15)).getTime());
        expect(timeline[1].props.task?.id).toBe(second.id);
        expect(timeline[2].props.task).toBeUndefined();
        expect('task' in timeline[2].props).toBe(false);
    });

    it('has a single empty entry when nothing is upcoming', () => {
        const timeline = buildNextTaskTimeline([task()], NOW);
        expect(timeline).toHaveLength(1);
        expect(timeline[0].props).toEqual({ remainingCount: 0 });
    });
});

describe('buildWorkspaceProps', () => {
    const ws = (name: string, taskCount: number, isBlueprint = false): Workspace => ({
        name,
        isBlueprint,
        color: '#123456',
        categories: [{ id: `${name}-cat`, name: 'General', tags: [], tasks: Array.from({ length: taskCount }, () => task({ categoryID: undefined })) }],
    });

    it('picks the non-blueprint workspace with the most open tasks', () => {
        const props = buildWorkspaceProps([ws('Small', 1), ws('Blueprint', 9, true), ws('Big', 3)], NOW);
        expect(props?.workspaceName).toBe('Big');
        expect(props?.pendingCount).toBe(3);
        expect(props?.tasks[0].categoryId).toBe('Big-cat');
        expect(props?.tasks[0].workspace).toBe('Big');
    });

    it('returns null when there are no regular workspaces', () => {
        expect(buildWorkspaceProps([ws('Blueprint', 2, true)], NOW)).toBeNull();
    });
});

describe('buildStreakProps', () => {
    it('labels the seven days ending today', () => {
        const props = buildStreakProps(5, 2, [1, 2, 3, 4, 0, 1, 2], NOW);
        // NOW is a Sunday
        expect(props.days.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
        expect(props.days[6].isToday).toBe(true);
        expect(props.days.filter((d) => d.isToday)).toHaveLength(1);
    });

    it('pads short histories and clamps levels', () => {
        const props = buildStreakProps(-1, 0, [9, -3], NOW);
        expect(props.days.map((d) => d.level)).toEqual([0, 0, 0, 0, 0, 4, 0]);
        expect(props.streak).toBe(0);
    });

    it('lights up today once something is completed, even before the server tallies it', () => {
        const props = buildStreakProps(3, 1, [0, 0, 0, 0, 0, 0, 0], NOW);
        expect(props.days[6].level).toBe(1);
    });
});
