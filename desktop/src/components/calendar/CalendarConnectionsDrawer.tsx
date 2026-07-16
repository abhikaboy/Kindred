import { useRef, useState } from "react";
import { toast } from "sonner";
import {
    CalendarBlank,
    Check,
    GoogleLogo,
    LinkBreak,
    ArrowsClockwise,
    SpinnerGap,
} from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    useCalendarConnections,
    useConnectionCalendars,
    useConnectGoogle,
    useSetupCalendar,
    useSyncCalendar,
    useDisconnectCalendar,
    pollForNewConnection,
    type CalendarConnection,
} from "@/hooks/useCalendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// Opens the auth URL in the system browser via Tauri opener, with window.open fallback.
async function openAuthUrl(url: string) {
    try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
    } catch {
        window.open(url, "_blank");
    }
}

// ── Sub-view: list of established connections ──────────────────────────────

type ConnectState = "idle" | "connecting" | "polling" | "timedOut";

type ListViewProps = {
    onSetup: (connectionId: string) => void;
};

function ListView({ onSetup }: ListViewProps) {
    const { connections, isLoading, refetch } = useCalendarConnections();
    const connectGoogle = useConnectGoogle();
    const syncCalendar = useSyncCalendar();
    const disconnectCalendar = useDisconnectCalendar();
    const [connectState, setConnectState] = useState<ConnectState>("idle");

    const handleConnect = async () => {
        setConnectState("connecting");
        try {
            const { auth_url } = await connectGoogle.mutateAsync();
            const knownIds = new Set(connections.map((c) => c.id));
            await openAuthUrl(auth_url);
            setConnectState("polling");
            const found = await pollForNewConnection(knownIds, {
                intervalMs: 3000,
                maxAttempts: 40,
            });
            if (found) {
                setConnectState("idle");
                onSetup(found.id);
            } else {
                setConnectState("timedOut");
            }
        } catch (err) {
            setConnectState("idle");
            toast.error("Failed to start Google Calendar connection");
        }
    };

    const handleSync = async (connectionId: string) => {
        try {
            const result = await syncCalendar.mutateAsync({ connectionId });
            toast.success(
                `Synced — ${result.tasks_created} created, ${result.tasks_skipped} skipped`
            );
            refetch();
        } catch {
            toast.error("Sync failed");
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        try {
            await disconnectCalendar.mutateAsync({ connectionId });
            refetch();
        } catch {
            toast.error("Failed to disconnect calendar");
        }
    };

    const completedConnections = connections.filter((c) => c.setup_complete);
    const isPolling = connectState === "polling";
    const isConnecting = connectState === "connecting";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                {isLoading ? (
                    <div className="flex items-center gap-2 py-6 text-muted-foreground">
                        <SpinnerGap size={16} className="animate-spin" />
                        <ThemedText type="caption">Loading…</ThemedText>
                    </div>
                ) : completedConnections.length === 0 ? (
                    <div className="py-6">
                        <ThemedText type="caption">No calendars connected yet.</ThemedText>
                    </div>
                ) : (
                    completedConnections.map((conn) => (
                        <ConnectionRow
                            key={conn.id}
                            connection={conn}
                            onSync={() => handleSync(conn.id)}
                            onDisconnect={() => handleDisconnect(conn.id)}
                            isSyncing={syncCalendar.isPending}
                            isDisconnecting={disconnectCalendar.isPending}
                        />
                    ))
                )}
            </div>

            {connectState === "timedOut" && (
                <p className="text-sm text-destructive">
                    Didn't detect a connection — try again.
                </p>
            )}

            {isPolling ? (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <SpinnerGap size={16} className="animate-spin" />
                        <ThemedText type="caption">Waiting for Google authorization…</ThemedText>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConnectState("idle")}
                    >
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnect}
                    disabled={isConnecting || isPolling}
                    className="gap-2"
                >
                    <GoogleLogo size={16} />
                    {isConnecting ? "Opening browser…" : "Connect Google Calendar"}
                </Button>
            )}
        </div>
    );
}

// ── Sub-component: one connected account row ───────────────────────────────

type ConnectionRowProps = {
    connection: CalendarConnection;
    onSync: () => void;
    onDisconnect: () => void;
    isSyncing: boolean;
    isDisconnecting: boolean;
};

function ConnectionRow({
    connection,
    onSync,
    onDisconnect,
    isSyncing,
    isDisconnecting,
}: ConnectionRowProps) {
    const lastSynced = connection.last_sync
        ? format(parseISO(connection.last_sync), "MMM d, h:mm a")
        : "Never";

    return (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <ThemedText type="defaultSemiBold" className="truncate text-sm">
                        {connection.provider_account_id}
                    </ThemedText>
                    <ThemedText type="caption">Last synced: {lastSynced}</ThemedText>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onSync}
                        disabled={isSyncing}
                        title="Sync now"
                    >
                        <ArrowsClockwise
                            size={15}
                            className={cn(isSyncing && "animate-spin")}
                        />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onDisconnect}
                        disabled={isDisconnecting}
                        title="Disconnect"
                        className="text-destructive hover:text-destructive"
                    >
                        <LinkBreak size={15} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Sub-view: calendar picker + options after OAuth ────────────────────────

type SetupViewProps = {
    connectionId: string;
    onComplete: () => void;
    onCancel: () => void;
};

function SetupView({ connectionId, onComplete, onCancel }: SetupViewProps) {
    const { calendars, isLoading } = useConnectionCalendars(connectionId);
    const setupCalendar = useSetupCalendar();
    const syncCalendar = useSyncCalendar();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [splitIntoWorkspaces, setSplitIntoWorkspaces] = useState(true);
    const [makePublic, setMakePublic] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);

    // Pre-select all once calendars load.
    const seededRef = useRef(false);
    if (!seededRef.current && calendars.length > 0) {
        seededRef.current = true;
        setSelectedIds(calendars.map((c) => c.id));
    }

    const toggleCalendar = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleCreate = async () => {
        if (selectedIds.length === 0) return;
        try {
            const pushEnabledCalendarIds = pushEnabled ? selectedIds : [];
            await setupCalendar.mutateAsync({
                connectionId,
                calendarIds: selectedIds,
                pushEnabledCalendarIds,
                mergeIntoOne: !splitIntoWorkspaces,
                makePublic,
            });
            const result = await syncCalendar.mutateAsync({ connectionId });
            toast.success(
                `Calendar set up — ${result.tasks_created} event${result.tasks_created === 1 ? "" : "s"} imported, ${result.tasks_skipped} skipped`
            );
            onComplete();
        } catch {
            toast.error("Failed to set up calendar");
        }
    };

    const isBusy = setupCalendar.isPending || syncCalendar.isPending;
    const buttonLabel = splitIntoWorkspaces ? "Create Workspaces" : "Create Workspace";

    return (
        <div className="flex flex-col gap-4">
            <div>
                <ThemedText type="subtitle">Set Up Calendar</ThemedText>
                <ThemedText type="caption" className="mt-0.5">
                    Choose which calendars to import
                </ThemedText>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                    <SpinnerGap size={16} className="animate-spin" />
                    <ThemedText type="caption">Loading calendars…</ThemedText>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {calendars.map((cal) => {
                        const selected = selectedIds.includes(cal.id);
                        return (
                            <button
                                key={cal.id}
                                type="button"
                                onClick={() => toggleCalendar(cal.id)}
                                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <ThemedText type="defaultSemiBold" className="text-sm">
                                        {cal.name}
                                    </ThemedText>
                                    {cal.is_primary && (
                                        <ThemedText type="caption" className="text-primary">
                                            Primary
                                        </ThemedText>
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        "ml-3 flex size-5 shrink-0 items-center justify-center rounded",
                                        selected
                                            ? "bg-primary"
                                            : "border border-border bg-transparent"
                                    )}
                                >
                                    {selected && <Check size={13} className="text-white" weight="bold" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col divide-y divide-border">
                <ToggleRow
                    label="Split into workspaces"
                    description={
                        splitIntoWorkspaces
                            ? "Each calendar gets its own workspace"
                            : "All calendars share one workspace"
                    }
                    checked={splitIntoWorkspaces}
                    onCheckedChange={setSplitIntoWorkspaces}
                />
                <ToggleRow
                    label="Public events"
                    description={
                        makePublic
                            ? "Imported events visible to friends"
                            : "Imported events kept private"
                    }
                    checked={makePublic}
                    onCheckedChange={setMakePublic}
                />
                <ToggleRow
                    label="Push tasks to calendar"
                    description={
                        pushEnabled
                            ? "Two-way sync — tasks write back to Google Calendar"
                            : "One-way import only"
                    }
                    checked={pushEnabled}
                    onCheckedChange={setPushEnabled}
                />
            </div>

            <div className="flex flex-col gap-2 pt-1">
                <Button
                    onClick={handleCreate}
                    disabled={selectedIds.length === 0 || isBusy}
                    className="w-full gap-2"
                >
                    {isBusy && <SpinnerGap size={14} className="animate-spin" />}
                    {buttonLabel}
                </Button>
                <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isBusy}
                    className="w-full"
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}

// ── Reusable toggle row ────────────────────────────────────────────────────

type ToggleRowProps = {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
};

function ToggleRow({ label, description, checked, onCheckedChange }: ToggleRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex flex-col gap-0.5">
                <ThemedText type="defaultSemiBold" className="text-sm">
                    {label}
                </ThemedText>
                <ThemedText type="caption">{description}</ThemedText>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

// ── Main drawer ─────────────────────────────────────────────────────────────

type DrawerView = "list" | "setup";

export function CalendarConnectionsDrawer() {
    const { connections } = useCalendarConnections();
    const disconnectCalendar = useDisconnectCalendar();
    const [view, setView] = useState<DrawerView>("list");
    const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    // Guard: true once setup completed so dismissing doesn't disconnect what we just set up.
    const setupCompletedRef = useRef(false);

    const completedConnections = connections.filter((c) => c.setup_complete);
    const linkedCount = completedConnections.length;

    const handleSetup = (connectionId: string) => {
        setupCompletedRef.current = false;
        setPendingConnectionId(connectionId);
        setView("setup");
    };

    const handleSetupComplete = () => {
        setupCompletedRef.current = true;
        setPendingConnectionId(null);
        setView("list");
    };

    // Any dismissal of an in-progress setup (Cancel button, X, overlay) drops the
    // pending connection so a half-linked account isn't left behind.
    const dismissSetup = async () => {
        if (pendingConnectionId && !setupCompletedRef.current) {
            try {
                await disconnectCalendar.mutateAsync({ connectionId: pendingConnectionId });
            } catch {
                // Best-effort cleanup.
            }
        }
        setPendingConnectionId(null);
        setView("list");
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && view === "setup") void dismissSetup();
        setOpen(nextOpen);
    };

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger
                render={
                    <button
                        type="button"
                        className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted",
                            linkedCount > 0
                                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                                : "border-border text-muted-foreground"
                        )}
                    />
                }
            >
                <CalendarBlank size={15} />
                <ThemedText type="caption" className={linkedCount > 0 ? "text-primary" : undefined}>
                    Calendars
                </ThemedText>
                {linkedCount > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                        {linkedCount}
                    </span>
                )}
            </SheetTrigger>

            <SheetContent side="right" className="w-[380px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>
                        {view === "setup" ? "Set Up Calendar" : "Connected calendars"}
                    </SheetTitle>
                </SheetHeader>

                <div className="px-4 pb-6">
                    {view === "list" ? (
                        <ListView onSetup={handleSetup} />
                    ) : (
                        <SetupView
                            connectionId={pendingConnectionId!}
                            onComplete={handleSetupComplete}
                            onCancel={() => void dismissSetup()}
                        />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
