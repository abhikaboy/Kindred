import * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  secureTextEntry?: boolean;
  textArea?: boolean;
  ghost?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  onSubmit?: () => void;
  name?: string;
  id?: string;
  className?: string;
};

const baseInput =
  "bg-secondary text-foreground rounded-xl px-6 py-4 text-base font-sans font-light border border-border w-full outline-none focus:border-primary transition-colors placeholder:text-muted-foreground disabled:opacity-50";

const ghostInput =
  "bg-transparent border-0 px-0 py-4 text-base font-sans font-light text-foreground w-full outline-none placeholder:text-muted-foreground disabled:opacity-50";

const baseTextarea =
  "bg-secondary text-foreground rounded-xl px-6 py-4 text-base font-sans font-light border border-border w-full outline-none focus:border-primary transition-colors placeholder:text-muted-foreground disabled:opacity-50 min-h-[120px] align-top resize-y";

const ThemedInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
  function ThemedInput(
    {
      value,
      onChange,
      placeholder,
      type = "text",
      secureTextEntry,
      textArea,
      ghost,
      disabled,
      autoFocus,
      onBlur,
      onSubmit,
      name,
      id,
      className,
    },
    ref
  ) {
    const classes = cn(ghost ? ghostInput : (textArea ? baseTextarea : baseInput), className);

    if (textArea) {
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          onBlur={onBlur}
          name={name}
          id={id}
          rows={4}
          className={classes}
        />
      );
    }

    const resolvedType = secureTextEntry ? "password" : type;

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        type={resolvedType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
        name={name}
        id={id}
        className={classes}
      />
    );
  }
);

export default ThemedInput;
