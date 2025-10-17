import { components } from "./generated/types";

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
    
    // Enhanced reminder features
    customMessage?: string;
    sound?: string;
    vibration?: boolean;
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
    
    // Completion tracking fields (only populated for completed tasks)
    timeCompleted?: string;
    timeTaken?: string;
}

export interface Categories {
    id: string;
    name: string;
    tasks: Task[];
}


export interface Workspace {
    name: string;
    categories: Categories[];
    isBlueprint: boolean;
}

export interface BlueprintWorkspace extends Workspace {
    blueprintDetails: components["schemas"]["BlueprintDocumentWithoutSubscribers"];
    isBlueprint: true;
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

// Relationship status types
export type RelationshipStatus = "none" | "requested" | "received" | "connected" | "self";

export interface RelationshipInfo {
    status: RelationshipStatus;
    request_id?: string;
}

export interface Profile {
    id: string;
    display_name: string;
    handle: string;
    profile_picture: string;
    tasks_complete: number;
    friends: string[];
    relationship?: RelationshipInfo;
}

// Notification types for custom Fiber endpoints (not in OpenAPI spec)
// Following the same patterns as generated types
export interface NotificationDocument {
    /** @description Unique notification identifier */
    id: string;
    /** @description Notification content/message */
    content: string;
    /** @description User who the notification is for */
    user: {
        /** @description User ID */
        id: string;
        /** @description User display name */
        display_name: string;
        /** @description User handle */
        handle: string;
        /** @description Profile picture URL */
        profile_picture: string;
    };
    /** @description Notification timestamp */
    time: string;
    /** @description Type of notification */
    notificationType: "ENCOURAGEMENT" | "COMMENT" | "CONGRATULATION" | "FRIEND_REQUEST" | "FRIEND_REQUEST_ACCEPTED";
    /** @description Reference ID (e.g., post ID, task ID) */
    reference_id: string;
    /** @description Whether notification has been read */
    read: boolean;
    /** @description Optional thumbnail image URL */
    thumbnail?: string;
    /** @description Receiver ID */
    receiver: string;
}

export interface NotificationsResponse {
    /** @description List of notifications */
    notifications: NotificationDocument[];
    /** @description Count of unread notifications */
    unread_count: number;
    /** @description Total number of notifications */
    total: number;
}

export interface MarkNotificationsReadRequest {
    /** @description Array of notification IDs to mark as read */
    notification_ids: string[];
}
export { components };

