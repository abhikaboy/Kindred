export type Priority = "1" | "2" | "3";

export interface TaskItem {
    id: string;
    content: string;
    points: number;
    priority: Priority;
}

export interface CategoryProps {
    id: string;
    name: string;
    tasks: TaskItem[];
    onLongPress: (categoryId: string) => void;
    onPress: (categoryId: string) => void;
}
