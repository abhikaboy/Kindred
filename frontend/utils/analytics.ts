/**
 * PostHog Analytics Event Catalog
 *
 * Central registry of all tracked events. Every event captured in the app
 * should use a constant from this file so we have a single source of truth.
 */

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

export const AnalyticsEvents = {
    // --- App Lifecycle ---
    APP_OPENED: "app_opened",
    APP_BACKGROUNDED: "app_backgrounded",
    APP_CRASHED: "app_crashed",

    // --- Screen Tracking ---
    SCREEN_VIEWED: "screen_viewed",

    // --- Authentication ---
    LOGIN_STARTED: "login_started",
    LOGIN_COMPLETED: "login_completed",
    LOGIN_FAILED: "login_failed",
    LOGOUT: "logout",
    REGISTER_STARTED: "register_started",
    REGISTER_COMPLETED: "register_completed",

    // --- Onboarding ---
    ONBOARDING_STEP_VIEWED: "onboarding_step_viewed",
    ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
    ONBOARDING_ABANDONED: "onboarding_abandoned",
    ONBOARDING_COMPLETED: "onboarding_completed",

    // --- Tab Navigation ---
    TAB_SWITCHED: "tab_switched",

    // --- Tasks ---
    TASK_FORM_STARTED: "task_form_started",
    TASK_CREATED: "task_created",
    TASK_COMPLETED: "task_completed",
    TASK_DELETED: "task_deleted",
    TASK_UPDATED: "task_updated",
    TASK_BULK_COMPLETED: "task_bulk_completed",
    TASK_BULK_DELETED: "task_bulk_deleted",
    TASK_UNDO_MISSED: "task_undo_missed",
    TASK_CHECKLIST_TOGGLED: "task_checklist_toggled",
    TASK_NOTES_UPDATED: "task_notes_updated",
    TASK_DEADLINE_SET: "task_deadline_set",
    TASK_REMINDER_SET: "task_reminder_set",
    TASK_VOICE_INPUT_USED: "task_voice_input_used",
    TASK_NATURAL_LANGUAGE_USED: "task_natural_language_used",

    // --- Feed & Social ---
    FEED_SCROLLED: "feed_scrolled",
    FEED_FILTER_CHANGED: "feed_filter_changed",
    POST_CREATED: "post_created",
    POST_VIEWED: "post_viewed",
    POST_DELETED: "post_deleted",
    POST_UPDATED: "post_updated",
    COMMENT_ADDED: "comment_added",
    COMMENT_DELETED: "comment_deleted",
    REACTION_ADDED: "reaction_added",
    REACTION_REMOVED: "reaction_removed",

    // --- Encouragement & Kudos ---
    ENCOURAGEMENT_SENT: "encouragement_sent",
    CONGRATULATION_SENT: "congratulation_sent",
    KUDOS_REDEEMED: "kudos_redeemed",
    KUDOS_VIEWED: "kudos_viewed",

    // --- Blueprints ---
    BLUEPRINT_VIEWED: "blueprint_viewed",
    BLUEPRINT_CREATED: "blueprint_created",
    BLUEPRINT_SUBSCRIBED: "blueprint_subscribed",
    BLUEPRINT_UNSUBSCRIBED: "blueprint_unsubscribed",
    BLUEPRINT_BROWSED: "blueprint_browsed",

    // --- Profile ---
    PROFILE_VIEWED: "profile_viewed",
    PROFILE_EDITED: "profile_edited",
    PROFILE_AVATAR_CHANGED: "profile_avatar_changed",

    // --- Search ---
    SEARCH_PERFORMED: "search_performed",
    SEARCH_RESULT_TAPPED: "search_result_tapped",

    // --- Connections ---
    FOLLOW_REQUEST_SENT: "follow_request_sent",
    FOLLOW_REQUEST_ACCEPTED: "follow_request_accepted",
    FOLLOW_REQUEST_REJECTED: "follow_request_rejected",
    USER_BLOCKED: "user_blocked",
    USER_UNBLOCKED: "user_unblocked",

    // --- Notifications ---
    NOTIFICATION_TAPPED: "notification_tapped",
    NOTIFICATION_RECEIVED: "notification_received",
    PUSH_PERMISSION_GRANTED: "push_permission_granted",
    PUSH_PERMISSION_DENIED: "push_permission_denied",

    // --- Calendar ---
    CALENDAR_CONNECTED: "calendar_connected",
    CALENDAR_DISCONNECTED: "calendar_disconnected",

    // --- Categories & Workspaces ---
    CATEGORY_CREATED: "category_created",
    CATEGORY_DELETED: "category_deleted",
    WORKSPACE_SWITCHED: "workspace_switched",

    // --- Groups ---
    GROUP_CREATED: "group_created",
    GROUP_VIEWED: "group_viewed",

    // --- Posting Flow ---
    POSTING_STARTED: "posting_started",
    POSTING_PHOTO_TAKEN: "posting_photo_taken",
    POSTING_GALLERY_SELECTED: "posting_gallery_selected",
    POSTING_PHOTOS_SKIPPED: "posting_photos_skipped",
    POSTING_CAPTION_ADDED: "posting_caption_added",
    POSTING_COMPLETED: "posting_completed",
    POSTING_ABANDONED: "posting_abandoned",

    // --- Settings ---
    SETTINGS_CHANGED: "settings_changed",
    FOCUS_MODE_TOGGLED: "focus_mode_toggled",

    // --- UI Interactions ---
    PULL_TO_REFRESH: "pull_to_refresh",
    BOTTOM_SHEET_OPENED: "bottom_sheet_opened",
    FAB_PRESSED: "fab_pressed",
    FAB_OPTION_SELECTED: "fab_option_selected",
    WORKSPACE_SELECTED: "workspace_selected",
    CREATE_MODAL_OPENED: "create_modal_opened",
    TASK_DETAIL_OPENED: "task_detail_opened",
    ERROR_DISPLAYED: "error_displayed",

    // --- Rewards & Referrals ---
    REWARD_VIEWED: "reward_viewed",
    REFERRAL_SHARED: "referral_shared",

    // --- Subscription / Revenue ---
    PAYWALL_VIEWED: "paywall_viewed",
    SUBSCRIPTION_STARTED: "subscription_started",
    SUBSCRIPTION_CANCELLED: "subscription_cancelled",

    // --- Share ---
    SHARE_ACTION: "share_action",
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// ---------------------------------------------------------------------------
// Onboarding step names (for consistent funnel tracking)
// ---------------------------------------------------------------------------

export const OnboardingSteps = {
    PRODUCTIVITY: { name: "productivity", index: 0 },
    POSITIVITY: { name: "positivity", index: 1 },
    PHONE: { name: "phone", index: 2 },
    NAME: { name: "name", index: 3 },
    PASSWORD: { name: "password", index: 4 },
    WELCOME: { name: "welcome", index: 5 },
    TUTORIAL: { name: "tutorial", index: 6 },
} as const;

// ---------------------------------------------------------------------------
// Tab names (for consistent tab tracking)
// ---------------------------------------------------------------------------

export const TabNames = {
    0: "tasks",
    1: "feed",
    2: "search",
    3: "activity",
    4: "profile",
} as const;
