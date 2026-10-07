import { useState } from "react";
import { MagicWand, X } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useEnrichOffer } from "@/hooks/useEnrich";
import { EnrichDialog } from "./EnrichDialog";

// Occasional offer to schedule and fill in neglected tasks (mobile AutoEnrichCard).
export function EnrichOffer() {
  const { status, offered, markHandled } = useEnrichOffer();
  const [open, setOpen] = useState(false);
  if (!status) return null;
  const n = status.candidateCount;

  return (
    <>
      {offered && (
        <div className="group flex items-center gap-1 rounded-full bg-background/70 py-1 pl-1 pr-1 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-14px_rgba(0,0,0,0.14)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-500 dark:bg-card/70">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2 transition-colors duration-150 hover:bg-primary/[0.06]"
          >
            <MagicWand size={14} className="text-primary transition-transform duration-300 group-hover:-rotate-12" />
            <ThemedText type="caption">
              {n} task{n === 1 ? " has" : "s have"} no day planned ·{" "}
              <span className="text-primary">Tidy up</span>
            </ThemedText>
          </button>
          <button
            type="button"
            aria-label="Not now"
            onClick={markHandled}
            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <EnrichDialog open={open} onOpenChange={setOpen} status={status} onApplied={markHandled} />
    </>
  );
}
