import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Loose, diffuse, low-opacity shadow (per design pref) — single source for all tiles.
const TILE =
  "rounded-3xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.08)]";

export function BentoTile({
  title,
  icon: Icon,
  action,
  to,
  className,
  contentClassName,
  children,
}: {
  title?: string;
  icon?: PhosphorIcon;
  action?: ReactNode;
  to?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const header = (title || Icon || action) && (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} weight="regular" className="text-muted-foreground" />}
        {title && (
          <ThemedText type="caption" className="uppercase tracking-wider">
            {title}
          </ThemedText>
        )}
      </div>
      {action}
    </div>
  );

  const inner = (
    <>
      {header}
      <div className={contentClassName}>{children}</div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          TILE,
          "block transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.25)]",
          className
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cn(TILE, className)}>{inner}</div>;
}
