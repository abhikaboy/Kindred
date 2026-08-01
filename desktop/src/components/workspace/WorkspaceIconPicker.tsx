import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, SquaresFour, X, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemedText } from "@/components/ThemedText";
import { SWATCHES } from "@/lib/swatches";
import { cn } from "@/lib/utils";

// Prefixes that produce navigation/directional icons not useful for workspace
// labelling — mirrors mobile's IconPickerOverlay EXCLUDED_PREFIXES.
const EXCLUDED_PREFIXES = ["Arrow", "Caret", "Cursor", "HandPointing", "NavigationArrow"];
const isExcluded = (name: string) => EXCLUDED_PREFIXES.some((p) => name.startsWith(p));

// Same lazy-load pattern as WorkspaceIcon.tsx — the icon set is its own chunk.
let iconsPromise: Promise<typeof import("@phosphor-icons/react")> | null = null;
const loadIcons = () => (iconsPromise ??= import("@phosphor-icons/react"));

// The web package exports each icon twice ("Acorn" and "AcornIcon"); computed
// once and cached across picker opens since the module itself never changes.
let cachedIconNames: string[] | null = null;
function iconNamesFrom(mod: Record<string, unknown>): string[] {
  if (!cachedIconNames) {
    cachedIconNames = Object.entries(mod)
      .filter(([key, val]) => typeof val === "object" && val !== null && !key.endsWith("Icon") && !isExcluded(key))
      .map(([key]) => key);
  }
  return cachedIconNames;
}

// Capped so the grid never renders the full ~1500-icon set at once; a search
// query narrows well below this in practice.
const MAX_RESULTS = 200;

export function WorkspaceIconPicker({
  icon,
  color,
  onChange,
}: {
  icon?: string | null;
  color?: string | null;
  onChange: (icon: string | null, color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState<Record<string, PhosphorIcon> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open || mod) return;
    let active = true;
    loadIcons().then((m) => active && setMod(m as unknown as Record<string, PhosphorIcon>));
    return () => {
      active = false;
    };
  }, [open, mod]);

  const iconNames = useMemo(() => (mod ? iconNamesFrom(mod) : []), [mod]);
  const filtered = useMemo(() => {
    const list = query ? iconNames.filter((n) => n.toLowerCase().includes(query.toLowerCase())) : iconNames;
    return list.slice(0, MAX_RESULTS);
  }, [iconNames, query]);

  const Preview = mod && icon ? mod[icon] : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Workspace icon and color"
        className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
        style={{ borderColor: color ?? undefined }}
      >
        {Preview && color ? (
          <Preview size={20} weight="bold" color={color} />
        ) : (
          <SquaresFour size={18} className="text-muted-foreground" />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
            <MagnifyingGlass size={14} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-8 gap-1 overflow-y-auto" style={{ maxHeight: 224 }}>
            {!mod ? (
              <ThemedText type="caption" className="col-span-8 text-muted-foreground">
                Loading icons…
              </ThemedText>
            ) : filtered.length === 0 ? (
              <ThemedText type="caption" className="col-span-8 text-muted-foreground">
                No matching icons.
              </ThemedText>
            ) : (
              filtered.map((name) => {
                const Icon = mod[name];
                const selected = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => onChange(name, color ?? SWATCHES[0])}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md hover:bg-muted",
                      selected && "bg-primary/10 ring-1 ring-primary",
                    )}
                  >
                    <Icon size={16} weight="regular" />
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  onClick={() => onChange(icon ?? null, color === hex ? null : hex)}
                  className={cn(
                    "size-6 rounded-full transition-transform hover:scale-105",
                    color === hex && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            {(icon || color) && (
              <button
                type="button"
                onClick={() => onChange(null, null)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
