import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  className,
  style,
}: {
  data: number[];
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!data || data.length < 2) return <div className={cn("h-5 w-14", className)} />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={style} className={cn("h-5 w-14 text-primary", className)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
