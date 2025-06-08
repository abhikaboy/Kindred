export type RequestFunction = (method: string, url: string, body?: any) => Promise<any>;

export interface LoginResponse {
    _id: string;
    email: string;
    displayName: string;
    handle: string;
    profilePicture: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
}

export interface Reminder {
    triggerTime: string; // ISO string
    type: string;
    sent: boolean;
    afterStart: boolean;
    beforeStart: boolean;
    beforeDeadline: boolean;
    afterDeadline?: boolean;
}

export interface ChecklistItem {
    content: string;
    completed: boolean;
    order: number;
    id?: string; // for frontend use
}

export interface RecurDetails {
    every: number;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    months?: number[];
    behavior: "BUILDUP" | "ROLLING";
    reminders?: string[];
}

export interface Task {
    id: string;
    priority: number;
    content: string;
    value: number;
    recurring: boolean;
    recurFrequency?: string;
    recurType?: string;
    recurDetails?: RecurDetails;
    public: boolean;
    active: boolean;
    timestamp: string;
    lastEdited: string;
    templateID?: string;
    userID?: string;
    categoryID?: string;
    deadline?: string;
    startTime?: string;
    startDate?: string;
    notes?: string;
    checklist?: ChecklistItem[];
    reminders?: Reminder[];
}

export interface Categories {
    id: string;
    name: string;
    tasks: Task[];
}

export interface Workspace {
    name: string;
    categories: Categories[];
}

export interface User {
    id: string;
    email: string;
    appleAccountID: string;
}

export interface UserResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export interface CompleteTaskBody {
    timeCompleted: string;
    timeTaken: string;
}
