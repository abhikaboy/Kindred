import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Copy, FileText, X } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemedText } from "@/components/ThemedText";

type Report = components["schemas"]["UserReportResponse"];
type Action = components["schemas"]["UserReportAction"];
type ReportHref = "/" | "/activity?view=patterns" | `/task/${string}` | `/account/${string}`;

function hrefFor(a: Action): ReportHref {
  switch (a.kind) {
    case "task":
      return `/task/${a.target}`;
    case "account":
      return `/account/${a.target}`;
    case "activity":
      return "/activity?view=patterns";
    default:
      return "/";
  }
}

// Quiet header button that opens the 90-day report.
export function GenerateReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-full bg-muted px-4 text-sm text-foreground transition-colors hover:bg-muted/70"
      >
        <FileText size={16} />
        Generate report
      </button>
      {open ? <ReportDialog open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

function ReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const report = $api.useQuery("get", "/v1/user/report", {}, { staleTime: 60 * 1000 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[85vh] max-w-[520px] gap-0 overflow-y-auto border-0 px-7 pb-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="sr-only">Your report</DialogTitle>
            <ThemedText type="titleFraunces" as="h2" aria-hidden>
              Your report
            </ThemedText>
            {report.data ? (
              <ThemedText type="caption" as="p" className="mt-1">
                {`${report.data.rangeLabel} · generated ${new Date(report.data.generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
              </ThemedText>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {report.isLoading ? (
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : report.data ? (
          <ReportBody report={report.data} onNavigate={() => onOpenChange(false)} />
        ) : (
          <ThemedText type="caption" as="p" className="mt-6">
            Couldn't build your report. Try again in a moment.
          </ThemedText>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportBody({ report, onNavigate }: { report: Report; onNavigate: () => void }) {
  const navigate = useNavigate();
  const go = (a: Action) => {
    onNavigate();
    navigate(hrefFor(a));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.plainText);
      toast.success("Report copied");
    } catch {
      toast.error("Couldn't copy. Try again.");
    }
  };
  const noticed = report.noticed ?? [];
  const known = report.known ?? [];
  const notYet = report.notYet ?? [];

  return (
    <div className="animate-in fade-in duration-200">
      <section className="mt-6 flex flex-col gap-5">
        <ThemedText type="larger_default" as="h3">
          What we noticed
        </ThemedText>
        {noticed.length === 0 ? (
          <ThemedText type="caption" as="p">
            Nothing stands out yet. Keep going and we'll have more to say.
          </ThemedText>
        ) : (
          noticed.map((n, i) => (
            <div key={i} className="flex flex-col gap-1">
              <ThemedText type="defaultSemiBold" as="p">
                {n.headline}
              </ThemedText>
              <ThemedText type="caption" as="p">
                {n.evidence}
              </ThemedText>
              {n.action ? (
                <button
                  type="button"
                  onClick={() => go(n.action!)}
                  className="mt-1 flex w-fit items-center gap-1 text-sm text-primary transition-opacity hover:opacity-70"
                >
                  {n.action.label}
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <ThemedText type="larger_default" as="h3">
          What we know about you
        </ThemedText>
        {known.map((k, i) => (
          <div key={i} className="flex flex-col">
            <ThemedText as="p">
              <span className="text-muted-foreground">{k.label}: </span>
              {k.value}
            </ThemedText>
            {k.detail ? (
              <ThemedText type="caption" as="p">
                {k.detail}
              </ThemedText>
            ) : null}
          </div>
        ))}
      </section>

      {notYet.length > 0 ? (
        <section className="mt-8 flex flex-col gap-2">
          <ThemedText type="larger_default" as="h3">
            Not yet
          </ThemedText>
          {notYet.map((s, i) => (
            <ThemedText key={i} type="caption" as="p">
              {s}
            </ThemedText>
          ))}
        </section>
      ) : null}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={copy}
          className="flex h-9 items-center gap-2 rounded-full bg-muted px-4 text-sm text-foreground transition-colors hover:bg-muted/70"
        >
          <Copy size={16} />
          Copy as text
        </button>
      </div>
    </div>
  );
}
