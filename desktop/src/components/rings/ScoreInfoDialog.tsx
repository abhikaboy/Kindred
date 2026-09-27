import { CalendarCheck, Fire, Target } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";

// Mirrors the scoring weights in backend/internal/handlers/rings/service.go.
// Each is a ceiling, not a guaranteed add, which is why they won't sum to the score.
const SCORE_BREAKDOWN = [
  { Icon: Target, label: "Close your rings", detail: "counted over the last 7 days", points: "up to 55" },
  { Icon: Fire, label: "Keep your streak alive", detail: "+1 per streak day", points: "up to 7" },
  { Icon: CalendarCheck, label: "Show up daily", detail: "close at least one ring", points: "up to 8" },
];

export function ScoreInfoDialog({ score, open, onOpenChange }: { score: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <div className="flex flex-col items-center gap-1">
          <ThemedText type="hero">{score}</ThemedText>
          <DialogTitle className="text-center font-heading text-[22px] font-semibold tracking-[-1px]">
            Introducing your Productivity Score
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-3.5">
          {SCORE_BREAKDOWN.map(({ Icon, label, detail, points }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/[0.12] text-primary">
                <Icon size={18} weight="fill" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <ThemedText type="defaultSemiBold">{label}</ThemedText>
                <ThemedText type="caption">{detail}</ThemedText>
              </div>
              <ThemedText type="defaultSemiBold" className="text-primary">
                {points}
              </ThemedText>
            </div>
          ))}
        </div>

        <ThemedText type="caption" className="leading-[18px]">
          Everyone starts at 30. These are ceilings, not guaranteed points: earn a share of each to climb toward 100.
        </ThemedText>

        <PrimaryButton title="Got it" onClick={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
