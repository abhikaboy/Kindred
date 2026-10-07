import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowSquareOut, SignOut, Trash } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { useAuth } from "@/contexts/auth";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { SettingsActionRow } from "@/components/settings/SettingsActionRow";
import type { components } from "@/lib/api/types.gen";

type UserSettings = components["schemas"]["UserSettings"];
type DisplaySettings = components["schemas"]["DisplaySettings"];

const AUTH_PARAMS = { params: { header: { Authorization: "" } } };

const THEME_OPTIONS = ["System", "Light", "Dark"];
const CHECKIN_OPTIONS = ["None", "Occasionally", "Regularly", "Frequently"];

const PRIVACY_URL = "https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a";
const TERMS_URL = "https://beaker.notion.site/Kindred-Terms-of-Service-342a5d52691580aa94afc9f0b95d5100";

export default function SettingsScreen() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { preference, setPreference } = useTheme();

    const settingsQuery = $api.useQuery("get", "/v1/user/settings", AUTH_PARAMS);
    const updateSettings = $api.useMutation("patch", "/v1/user/settings");
    const deleteAccount = $api.useMutation("delete", "/v1/user/account");

    // Local mirror of the full settings object; toggles patch the merged whole.
    const [settings, setSettings] = useState<UserSettings | null>(null);
    useEffect(() => {
        if (settingsQuery.data) setSettings(settingsQuery.data);
    }, [settingsQuery.data]);

    const save = (next: UserSettings) => {
        setSettings(next);
        updateSettings.mutate({ ...AUTH_PARAMS, body: next });
    };

    const toggleDisplay = (key: keyof DisplaySettings) => {
        if (!settings) return;
        save({ ...settings, display: { ...settings.display, [key]: !settings.display[key] } });
    };

    const setCheckin = (option: string) => {
        if (!settings) return;
        save({
            ...settings,
            notifications: { ...settings.notifications, checkin_frequency: option.toLowerCase() },
        });
    };

    const handleDeleteAccount = () => {
        // ponytail: native confirm; swap for the planned CustomAlert kit component later.
        if (!window.confirm("Permanently delete your account? This cannot be undone and removes all your data.")) return;
        deleteAccount.mutate(AUTH_PARAMS, {
            onSuccess: () => {
                logout();
                navigate("/login", { replace: true });
            },
        });
    };

    const handleLogout = () => {
        if (!window.confirm("Log out of Kindred?")) return;
        logout();
        navigate("/login", { replace: true });
    };

    const settingsError = !settingsQuery.isLoading && !settings;

    return (
        <div className="mx-auto flex max-w-2xl flex-col pt-6">
            <ThemedText type="titleFraunces" as="h1" className="mb-8">
                Settings
            </ThemedText>

            <SettingsSection title="Appearance">
                <ThemedText>Theme</ThemedText>
                <ThemedText type="caption" className="mb-3 mt-1 block">
                    System follows your device setting
                </ThemedText>
                <SegmentedControl
                    options={THEME_OPTIONS}
                    value={preference.charAt(0).toUpperCase() + preference.slice(1)}
                    onChange={(o) => setPreference(o.toLowerCase() as ThemePreference)}
                />
            </SettingsSection>

            {settingsError ? (
                <SettingsSection title="Preferences">
                    <ThemedText type="caption">
                        Couldn’t load your settings. Please try again later.
                    </ThemedText>
                </SettingsSection>
            ) : (
                <>
                    <SettingsSection title="Notifications">
                        <ThemedText>Check-in frequency</ThemedText>
                        <ThemedText type="caption" className="mb-3 mt-1 block">
                            How often you’d like reminders about overdue tasks
                        </ThemedText>
                        {settings ? (
                            <SegmentedControl
                                options={CHECKIN_OPTIONS}
                                value={
                                    CHECKIN_OPTIONS.find(
                                        (o) => o.toLowerCase() === settings.notifications.checkin_frequency,
                                    ) ?? "Regularly"
                                }
                                onChange={setCheckin}
                            />
                        ) : (
                            <Skeleton className="h-11 w-full rounded-full" />
                        )}
                    </SettingsSection>

                    <SettingsSection title="Display">
                        <SettingsCard>
                            {settings ? (
                                <>
                                    <SettingsToggleRow
                                        label="Friend activity"
                                        checked={settings.display.friend_activity_feed}
                                        onCheckedChange={() => toggleDisplay("friend_activity_feed")}
                                    />
                                    <SettingsToggleRow
                                        label="Near deadlines"
                                        checked={settings.display.near_deadlines_widget}
                                        onCheckedChange={() => toggleDisplay("near_deadlines_widget")}
                                    />
                                    <SettingsToggleRow
                                        label="Show task details"
                                        checked={settings.display.show_task_details}
                                        onCheckedChange={() => toggleDisplay("show_task_details")}
                                    />
                                    <SettingsToggleRow
                                        label="Recent workspaces"
                                        checked={settings.display.recent_workspaces}
                                        onCheckedChange={() => toggleDisplay("recent_workspaces")}
                                        isLast
                                    />
                                </>
                            ) : (
                                <div className="py-2">
                                    <Skeleton className="my-2 h-6 w-full" />
                                    <Skeleton className="my-2 h-6 w-full" />
                                    <Skeleton className="my-2 h-6 w-full" />
                                </div>
                            )}
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Privacy and data">
                        <SettingsCard>
                            {settings ? (
                                <SettingsToggleRow
                                    label="Content filter"
                                    checked={settings.display.content_filter}
                                    onCheckedChange={() => toggleDisplay("content_filter")}
                                    isLast
                                />
                            ) : (
                                <Skeleton className="my-3 h-6 w-full" />
                            )}
                        </SettingsCard>
                    </SettingsSection>
                </>
            )}

            <SettingsSection title="Legal">
                <SettingsActionRow
                    label="Privacy policy"
                    onClick={() => window.open(PRIVACY_URL, "_blank", "noopener,noreferrer")}
                    icon={<ArrowSquareOut className="size-5 text-muted-foreground" />}
                />
                <SettingsActionRow
                    label="Terms and conditions"
                    onClick={() => window.open(TERMS_URL, "_blank", "noopener,noreferrer")}
                    icon={<ArrowSquareOut className="size-5 text-muted-foreground" />}
                />
            </SettingsSection>

            <SettingsSection title="Account">
                <SettingsActionRow
                    label="Delete account"
                    onClick={handleDeleteAccount}
                    destructive
                    disabled={deleteAccount.isPending}
                    icon={<Trash className="size-5 text-destructive" />}
                />
                <SettingsActionRow
                    label="Log out"
                    onClick={handleLogout}
                    destructive
                    icon={<SignOut className="size-5 text-destructive" />}
                />
            </SettingsSection>
        </div>
    );
}
