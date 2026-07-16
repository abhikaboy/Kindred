import * as React from "react";
import { cn } from "@/lib/utils";

// The Linear-style property pill: bordered chip with an icon + label, used as a
// popover trigger. `active` = a value is set (brighter text + subtle fill).
export const PropertyPill = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: React.ReactNode;
    active?: boolean;
  }
>(({ icon, active, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
      active ? "text-foreground" : "text-muted-foreground",
      className,
    )}
    {...props}
  >
    {icon}
    <span className="whitespace-nowrap">{children}</span>
  </button>
));
PropertyPill.displayName = "PropertyPill";
