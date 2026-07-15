import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  onClick?: () => void;
  type?: "button" | "submit";
  ghost?: boolean;
  outline?: boolean;
  dottedOutline?: boolean;
  lightened?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  colorOverride?: string;
  testID?: string;
};

const buttonVariants = cva(
  "w-full rounded-xl py-4 text-[15px] font-medium font-sans text-center transition-opacity disabled:opacity-50 disabled:pointer-events-none hover:opacity-90 active:opacity-80 cursor-pointer inline-flex items-center justify-center gap-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-primary/20 text-primary",
        lightened: "bg-primary/15 text-primary",
        outline: "bg-secondary text-muted-foreground border border-muted-foreground",
        ghost: "bg-transparent text-primary",
        dottedOutline:
          "bg-transparent text-primary border border-dashed border-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// Precedence mirrors the mobile getBackgroundColor/getTextColor order.
function resolveVariant({
  ghost,
  dottedOutline,
  secondary,
  lightened,
  outline,
}: Pick<Props, "ghost" | "dottedOutline" | "secondary" | "lightened" | "outline">) {
  if (ghost) return "ghost" as const;
  if (dottedOutline) return "dottedOutline" as const;
  if (secondary) return "secondary" as const;
  if (lightened) return "lightened" as const;
  if (outline) return "outline" as const;
  return "default" as const;
}

export default function PrimaryButton({
  title,
  onClick,
  type = "button",
  ghost,
  outline,
  dottedOutline,
  lightened,
  secondary,
  disabled,
  children,
  className,
  colorOverride,
  testID,
}: Props): React.JSX.Element {
  const variant = resolveVariant({ ghost, dottedOutline, secondary, lightened, outline });

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-testid={testID}
      className={cn(buttonVariants({ variant }), className)}
      style={colorOverride ? { color: colorOverride } : undefined}
    >
      {children}
      <span>{title}</span>
    </button>
  );
}
