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
