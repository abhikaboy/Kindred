import { useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

export type Suggestion = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
};

// Rounded-pill search field with a primary magnifier button (→ X to clear) and an
// optional autocomplete dropdown. Ports the mobile SearchBox look.
export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  suggestions,
  onSelectSuggestion,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  suggestions?: Suggestion[];
  onSelectSuggestion?: (s: Suggestion) => void;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const showDropdown = focused && !!suggestions && suggestions.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-full border bg-background py-1 pl-5 pr-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent py-2 font-sans font-light text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={hasValue ? () => onChange("") : undefined}
          disabled={!hasValue}
          aria-label={hasValue ? "Clear" : "Search"}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full transition-colors",
            hasValue ? "bg-transparent text-foreground" : "bg-primary text-primary-foreground"
          )}
        >
          {hasValue ? (
            <X size={20} weight="light" />
          ) : (
            <MagnifyingGlass size={20} weight="light" />
          )}
        </button>
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-3xl border bg-background py-2 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.18)]">
          {suggestions!.map((s) => (
            <button
              key={s.id}
              type="button"
              // onMouseDown fires before the input's blur, so the selection isn't lost.
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectSuggestion?.(s);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
            >
              {s.image ? (
                <img src={s.image} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary">
                  <MagnifyingGlass size={16} weight="light" className="text-primary-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <ThemedText type="defaultSemiBold" className="block truncate">
                  {s.title}
                </ThemedText>
                {s.subtitle && (
                  <ThemedText type="caption" className="block truncate">
                    {s.subtitle}
                  </ThemedText>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
