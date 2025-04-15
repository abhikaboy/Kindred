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

export interface Task {
    id: string;
    content: string;
    value: number;
    priority: "1" | "2" | "3";
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
