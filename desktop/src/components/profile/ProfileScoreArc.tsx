import { useEffect, useState } from "react";
import { ThemedText } from "@/components/ThemedText";

// Geometry ported 1:1 from mobile ScoreArc.tsx.
const W = 200;
const H = 120;
const STROKE = 10;
const R = (W - STROKE) / 2;
const CX = W / 2;
const CY = H - 10;
const PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}`;
const LEN = Math.PI * R;

export function ProfileScoreArc({ score }: { score: number }) {
    const fraction = Math.min(Math.max(score / 100, 0), 1);
    const [offset, setOffset] = useState(LEN);
    useEffect(() => {
        const t = setTimeout(() => setOffset(LEN * (1 - fraction)), 50);
        return () => clearTimeout(t);
    }, [fraction]);

    const display = score >= 30 ? score : "--";

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: W, height: H }}>
                <svg width={W} height={H}>
                    <path d={PATH} stroke="var(--border)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
                    {fraction > 0 && (
                        <path
                            d={PATH}
                            stroke="var(--primary)"
                            strokeWidth={STROKE}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={LEN}
                            strokeDashoffset={offset}
                            style={{ transition: "stroke-dashoffset 800ms ease-out" }}
                        />
                    )}
                </svg>
                <div className="absolute inset-x-0 bottom-2 text-center">
                    <ThemedText as="div" className="font-heading text-4xl font-semibold">
                        {display}
                    </ThemedText>
                </div>
            </div>
            <div className="-mt-1 flex w-[200px] items-center justify-between">
                <ThemedText type="caption" className="w-6 text-[10px]">
                    0
                </ThemedText>
                <ThemedText type="caption" className="whitespace-pre text-center text-[10px] tracking-wider">
                    {"PRODUCTIVITY\nSCORE"}
                </ThemedText>
                <ThemedText type="caption" className="w-6 text-right text-[10px]">
                    100
                </ThemedText>
            </div>
        </div>
    );
}
