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
      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-150 active:scale-[0.97]",
      active ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
      className,
    )}
    {...props}
  >
    {icon}
    <span className="whitespace-nowrap">{children}</span>
  </button>
));
PropertyPill.displayName = "PropertyPill";
