import type { ReactNode, JSX } from "react";
import { Link } from "react-router-dom";
import { User } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// A profile row: avatar, display name, handle, and a right-side action slot.
// When userId is given, the identity links to that profile; the action stays separate.
export function UserRow({
  displayName,
  handle,
  profilePicture,
  action,
  className,
  userId,
}: {
  displayName: string;
  handle: string;
  profilePicture?: string;
  action?: ReactNode;
  className?: string;
  userId?: string;
}): JSX.Element {
  const identity = (
    <>
      {profilePicture ? (
        <img
          src={profilePicture}
          alt=""
          className="size-10 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-full border bg-muted">
          <User size={20} weight="light" className="text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <ThemedText type="defaultSemiBold" className="block truncate">
          {displayName}
        </ThemedText>
        {/* handle already includes a leading @ — don't prepend another */}
        <ThemedText type="caption" className="block truncate">
          {handle}
        </ThemedText>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50",
        className
      )}
    >
      {userId ? (
        <Link to={`/account/${userId}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3">{identity}</div>
      )}
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export default UserRow;
