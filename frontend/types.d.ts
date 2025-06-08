type TaskData = {
    workspaces: any[];
};
type Workspace = {
    name: string;
    categories: any[];
};
type Categories = {
    name: string;
    id: string;
    tasks: any[];
};

type BottomMenuOption = {
    label: string;
    icon: string;
    callback: () => void;
};

type Reminder = {
    triggerTime: Date;
    type: string;
    sent: boolean;
    afterStart: boolean;
    beforeStart: boolean;
    beforeDeadline: boolean;
    afterDeadline: boolean;
};

// Types for nested structures
type RecurDetails = {
    every: number;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    months?: number[];
    behavior: "BUILDUP" | "ROLLING";
    reminders?: string[];
};

type ChecklistItem = {
    content: string;
    completed: boolean;
    order: number;
};

type Reminder = {
    triggerTime: string;
    type: string;
    sent: boolean;
    afterStart: boolean;
    beforeStart: boolean;
    beforeDeadline: boolean;
};

type Priority = "1" | "2" | "3";

type Props = {
    content: string;
    points: number;
    priority: Priority;
    id?: string;
    redirect?: boolean;
    categoryId?: string;
};
type Option = {
    label: string;
    id: string;
    special?: boolean;
};
