import React from "react";
import { cn } from "@/lib/utils";

export type ThemedTextType =
    | "default"
    | "heading"
    | "fancyFrauncesHeading"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "hero"
    | "lightBody"
    | "caption"
    | "captionLight"
    | "disabledTitle"
    | "smallerDefault"
    | "titleFraunces"
    | "subtitle_subtle"
    | "larger_default"
    | "larger_default_light"
    | "subheading"
    | "fancyFrauncesSubheading";

const VARIANTS: Record<ThemedTextType, string> = {
    default: "font-sans font-light text-base",
    defaultSemiBold: "font-sans text-base",
    lightBody: "font-sans font-light text-base",
    smallerDefault: "font-sans text-sm",
    larger_default: "font-sans text-[17px]",
    larger_default_light: "font-sans text-[17px] text-muted-foreground",
    caption: "font-sans font-light text-sm text-muted-foreground",
    captionLight: "font-sans font-light text-sm text-muted-foreground",
    subtitle: "font-sans font-medium text-lg",
    subtitle_subtle: "font-sans font-medium text-sm text-muted-foreground py-4",
    subheading: "font-sans font-light text-2xl",
    heading: "font-sans font-semibold text-[32px] tracking-[-1px]",
    title: "font-heading font-semibold text-[32px] tracking-[-2px]",
    titleFraunces: "font-heading font-semibold text-[32px] tracking-[-2px]",
    fancyFrauncesHeading: "font-heading font-semibold text-[32px] tracking-[-1px]",
    fancyFrauncesSubheading: "font-heading font-semibold text-2xl tracking-[-1px]",
    hero: "font-sans font-semibold text-5xl tracking-[-1px] text-foreground",
    link: "font-sans text-base leading-[30px] text-muted-foreground underline",
    disabledTitle: "font-sans font-medium text-xl text-muted-foreground opacity-50",
};

export type ThemedTextProps = React.HTMLAttributes<HTMLElement> & {
    type?: ThemedTextType;
    as?: keyof React.JSX.IntrinsicElements;
};

export function ThemedText({ type = "default", as = "span", className, ...rest }: ThemedTextProps): React.JSX.Element {
    const Component = as as React.ElementType;
    return <Component className={cn("text-foreground", VARIANTS[type], className)} {...rest} />;
}
