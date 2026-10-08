import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

export type WeekRecap = components["schemas"]["WeekRecapResponse"];
type Card = components["schemas"]["WeekRecapCard"];

// The weekly story: one card at a time, quiet cross-fades, one action per card.
export function WeekStory({ recap, open, onOpenChange }: { recap: WeekRecap; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [i, setI] = useState(0);
  const cards = recap.cards ?? [];
  const card = cards[Math.min(i, cards.length - 1)];
  const last = i >= cards.length - 1;

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, cards.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cards.length]);

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[440px] gap-0 border-0 px-7 pb-4 pt-3">
        <div className="flex gap-1 pt-2" aria-hidden>
          {cards.map((_, k) => (
            <span key={k} className={cn("h-[3px] flex-1 rounded-full transition-colors duration-200", k <= i ? "bg-primary" : "bg-primary/15")} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <DialogTitle className="font-sans text-sm font-light text-muted-foreground">Your week · {recap.rangeLabel}</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div key={i} className="flex min-h-[460px] flex-col justify-center py-6 animate-in fade-in duration-200">
          <CardVisual card={card} recap={recap} />
          <ThemedText type="fancyFrauncesHeading" as="h2" className="mt-8 leading-tight">
            {card.headline}
          </ThemedText>
          {card.body ? <ThemedText as="p" className="mt-3">{card.body}</ThemedText> : null}
          {card.caption ? <ThemedText type="caption" as="p" className="mt-2">{card.caption}</ThemedText> : null}
        </div>

        <CardAction card={card} onDone={() => (last ? onOpenChange(false) : setI(i + 1))} />

        <div className="mt-3 flex h-10 items-center justify-between">
          {i > 0 ? (
            <button type="button" onClick={() => setI(i - 1)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
              <CaretLeft size={14} />
              <ThemedText type="caption" className="text-inherit">Back</ThemedText>
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => (last ? onOpenChange(false) : setI(i + 1))}
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
          >
            <ThemedText type="smallerDefault">{last ? "Done" : "Next"}</ThemedText>
            {last ? null : <CaretRight size={14} />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CardAction({ card, onDone }: { card: Card; onDone: () => void }) {
  const qc = useQueryClient();
  const plan = $api.useMutation("put", "/v1/user/tasks/{category}/{id}/plan");
  const a = card.action;

  if (card.kind === "share") {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(card.shareText ?? `${card.headline} ${card.body}`);
        toast.success("Copied, ready to share");
      } catch {
        toast.error("Couldn't copy. Try again.");
      }
    };
    return <PrimaryButton title="Copy to share" onClick={copy} />;
  }
  if (!a) return <div className="h-12" />;

  const run = async () => {
    try {
      await plan.mutateAsync({
        params: { header: { Authorization: "" }, path: { category: a.categoryId, id: a.taskId } },
        body: { step: a.step, size: a.size, at: a.at },
      });
      toast.success(a.done);
      qc.invalidateQueries();
      onDone();
    } catch {
      toast.error("Couldn't save the plan. Try again.");
    }
  };
  return <PrimaryButton title={a.label} onClick={run} disabled={plan.isPending} />;
}

function CardVisual({ card, recap }: { card: Card; recap: WeekRecap }) {
  switch (card.kind) {
    case "week":
      return card.weeks?.length ? <Bars bars={card.weeks} usual={card.usual} /> : card.days ? <Bars bars={card.days} /> : null;
    case "peak":
      return card.hours ? <HourStrip hours={card.hours} peak={card.peakHour} /> : null;
    case "habit":
      return card.habitGrid ? <HabitGrid grid={card.habitGrid} /> : null;
    case "supporters":
      return <People people={card.people ?? []} />;
    case "share":
      return <ThemedText type="caption">{recap.rangeLabel} · kindredtodo.com</ThemedText>;
    default:
      return null;
  }
}

function Bars({ bars, usual }: { bars: Card["weeks"] & object; usual?: number }) {
  const max = Math.max(1, usual ? usual * 1.6 : 0, ...bars.map((b) => b.value));
  const h = 120;
  return (
    <div className="relative flex flex-col gap-2">
      <div className="relative flex items-end justify-between gap-3" style={{ height: h }}>
        {usual ? (
          <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/60" style={{ bottom: (usual / max) * h }} />
        ) : null}
        {bars.map((b, k) => (
          <div
            key={k}
            title={`${b.value}`}
            className={cn("flex-1 rounded-md", b.current ? "bg-primary" : "bg-primary/40")}
            style={{ height: Math.max(4, (b.value / max) * h) }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-3">
        {bars.map((b, k) => (
          <ThemedText key={k} type="caption" className="flex-1 truncate text-center text-xs">
            {b.label}
          </ThemedText>
        ))}
      </div>
    </div>
  );
}

const HOUR_TICKS: Record<number, string> = { 0: "12 AM", 6: "6 AM", 12: "12 PM", 18: "6 PM" };

function HourStrip({ hours, peak }: { hours: number[]; peak?: number }) {
  const max = Math.max(1, ...hours);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-20 items-end gap-[2px]">
        {hours.map((v, h) => (
          <div
            key={h}
            className={cn("flex-1 rounded-sm", h === peak ? "bg-primary" : "bg-primary/30")}
            style={{ height: Math.max(2, (v / max) * 80) }}
          />
        ))}
      </div>
      <div className="flex">
        {hours.map((_, h) => (
          <ThemedText key={h} type="caption" className="flex-1 overflow-visible whitespace-nowrap text-xs">
            {HOUR_TICKS[h] ?? ""}
          </ThemedText>
        ))}
      </div>
    </div>
  );
}

function HabitGrid({ grid }: { grid: number[][] }) {
  return (
    <div className="flex flex-col gap-2">
      {grid.map((row, w) => (
        <div key={w} className="flex items-center gap-4">
          <ThemedText type="caption" className="w-14">
            {w === grid.length - 1 ? "This week" : `Week ${w + 1}`}
          </ThemedText>
          <div className="flex gap-2">
            {row.map((v, d) => (
              <span
                key={d}
                className={cn(
                  "size-[14px] rounded-full",
                  v === 1 ? "bg-primary" : v === 0 ? "shadow-[inset_0_0_0_1.5px] shadow-primary/25" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function People({ people }: { people: components["schemas"]["WeekRecapPerson"][] }) {
  return (
    <div className="flex flex-col gap-4">
      {people.map((p) => (
        <div key={p.id} className="flex items-center gap-3">
          {p.icon ? (
            <img src={p.icon} alt="" className="size-10 shrink-0 rounded-full bg-muted object-cover" />
          ) : (
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">{p.name.charAt(0)}</div>
          )}
          <div className="min-w-0">
            <ThemedText as="p" className="truncate">
              {p.name} · {p.line}
            </ThemedText>
            <ThemedText type="caption" as="p" className="truncate">
              {p.context}
            </ThemedText>
          </div>
        </div>
      ))}
    </div>
  );
}
