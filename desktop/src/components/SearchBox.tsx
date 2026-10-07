import { useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";

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
      <div className="flex h-12 items-center gap-3 rounded-full bg-background pl-5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.12)] transition-shadow duration-200 focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18)] dark:bg-card">
        <MagnifyingGlass size={18} className="shrink-0 text-muted-foreground" />
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
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground animate-in fade-in duration-150"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-3xl bg-background py-2 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.18)]">
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
