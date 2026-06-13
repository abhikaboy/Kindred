import { render, fireEvent } from "@testing-library/react-native";
import { WorkspaceSwitcherList } from "@/components/ui/WorkspaceSwitcherList";
import type { Workspace } from "@/api/types";

const ws = (name: string, opts: Partial<Workspace> & { counts?: number[] } = {}): Workspace => ({
    name,
    isBlueprint: opts.isBlueprint ?? false,
    icon: opts.icon ?? null,
    color: opts.color ?? null,
    categories: (opts.counts ?? []).map((n) => ({
        tasks: Array.from({ length: n }, () => ({ active: true })),
    })) as Workspace["categories"],
});

describe("WorkspaceSwitcherList", () => {
    test("renders a Calendar row", () => {
        const { getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[]}
                selected=""
                onSelectCalendar={jest.fn()}
                onSelectWorkspace={jest.fn()}
            />
        );
        getByText("Calendar");
    });

    test("omits the Calendar row when onSelectCalendar is not provided", () => {
        const { queryByText, getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[ws("Work")]}
                selected=""
                onSelectWorkspace={jest.fn()}
            />
        );
        expect(queryByText("Calendar")).toBeNull();
        getByText("Work");
    });

    test("renders each non-blueprint workspace by name", () => {
        const { getByText, queryByText } = render(
            <WorkspaceSwitcherList
                workspaces={[ws("Work"), ws("Personal"), ws("Template", { isBlueprint: true })]}
                selected=""
                onSelectCalendar={jest.fn()}
                onSelectWorkspace={jest.fn()}
            />
        );
        getByText("Work");
        getByText("Personal");
        expect(queryByText("Template")).toBeNull();
    });

    test("shows the active task count per workspace", () => {
        const { getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[ws("Work", { counts: [2, 3] })]}
                selected=""
                onSelectCalendar={jest.fn()}
                onSelectWorkspace={jest.fn()}
            />
        );
        getByText("5");
    });

    test("ignores inactive tasks in the count", () => {
        const inactive: Workspace = {
            name: "Work",
            isBlueprint: false,
            icon: null,
            color: null,
            categories: [
                { tasks: [{ active: true }, { active: false }, { active: true }] },
            ] as Workspace["categories"],
        };
        const { getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[inactive]}
                selected=""
                onSelectCalendar={jest.fn()}
                onSelectWorkspace={jest.fn()}
            />
        );
        getByText("2");
    });

    test("calls onSelectCalendar when the Calendar row is pressed", () => {
        const onSelectCalendar = jest.fn();
        const { getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[]}
                selected=""
                onSelectCalendar={onSelectCalendar}
                onSelectWorkspace={jest.fn()}
            />
        );
        fireEvent.press(getByText("Calendar"));
        expect(onSelectCalendar).toHaveBeenCalledTimes(1);
    });

    test("calls onSelectWorkspace with the workspace name when pressed", () => {
        const onSelectWorkspace = jest.fn();
        const { getByText } = render(
            <WorkspaceSwitcherList
                workspaces={[ws("Work")]}
                selected=""
                onSelectCalendar={jest.fn()}
                onSelectWorkspace={onSelectWorkspace}
            />
        );
        fireEvent.press(getByText("Work"));
        expect(onSelectWorkspace).toHaveBeenCalledWith("Work");
    });
});
