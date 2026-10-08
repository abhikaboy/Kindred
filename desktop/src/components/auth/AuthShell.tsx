import { useEffect, useState, type ReactNode } from "react";
import { Check, HandsClapping } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Each photo tells a tiny Kindred story: a task gets checked off, then a friend sends kudos.
// `card` places the task where the photo has room; `bubble` pins the kudos to a different corner.
// Avatars reuse crops of the other photos so the set feels like one friend group.
const SCENES = [
  {
    photo: 1, task: "Host Sunday dinner", meta: "7:00 PM · Weekly",
    from: { name: "Priya", photo: 5 }, kudos: "Save me a plate", cheers: [3, 6, 2],
    card: "left-12 bottom-24", bubble: "-top-14 -right-28 rotate-[-3deg] origin-bottom-left",
  },
  {
    photo: 2, task: "Hit 10k steps", meta: "Today · Daily",
    from: { name: "Maya", photo: 3 }, kudos: "Night walks count double", cheers: [1, 5],
    card: "left-12 top-1/3", bubble: "-bottom-16 left-24 rotate-[2deg] origin-top-left",
  },
  {
    photo: 3, task: "Shoot a roll of film", meta: "Saturday",
    from: { name: "Jordan", photo: 6 }, kudos: "Send the scans", cheers: [2, 4, 1],
    card: "right-12 bottom-24", bubble: "-top-14 -left-20 rotate-[3deg] origin-bottom-right",
  },
  {
    photo: 4, task: "Read 20 pages", meta: "On the commute · Daily",
    from: { name: "Sam", photo: 2 }, kudos: "12 days in a row", cheers: [6, 3],
    card: "left-12 top-20", bubble: "-bottom-16 -right-16 rotate-[-2deg] origin-top-left",
  },
  {
    photo: 5, task: "Finish chapter 4", meta: "2:00 PM · With 3 friends",
    from: { name: "Leo", photo: 1 }, kudos: "Study date again Friday?", cheers: [4, 6, 3],
    card: "right-12 top-20", bubble: "-bottom-16 -left-24 rotate-[3deg] origin-top-right",
  },
  {
    photo: 6, task: "Pick next month's book", meta: "Book club",
    from: { name: "Ava", photo: 4 }, kudos: "Your turn to choose", cheers: [5, 2],
    card: "left-1/2 -translate-x-1/2 bottom-24", bubble: "-top-14 right-8 rotate-[-2deg] origin-bottom-right",
  },
];
const photo = (n: number) => `/auth/photo-${n}.jpg`;
const SCENE_MS = 10000;
// Beats within a scene: card lands, task gets checked, kudos arrives.
const CHECK_AT = 1800;
const KUDOS_AT = 3400;
// Outgoing scene keeps its final state until it has fully faded.
const FADE_MS = 1000;

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-20px_rgba(0,0,0,0.45)]";
const ENCOURAGED_GLOW = "0 0 10px rgba(133,77,255,0.22), 0 1px 4px rgba(133,77,255,0.12)";

function Avatar({ n, className }: { n: number; className?: string }) {
  return <img src={photo(n)} alt="" className={cn("shrink-0 rounded-full object-cover ring-2 ring-background", className)} />;
}

function Story({ scene, active }: { scene: (typeof SCENES)[number]; active: boolean }) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!active) {
      const t = setTimeout(() => setBeat(0), FADE_MS);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setBeat(1), CHECK_AT);
    const t2 = setTimeout(() => setBeat(2), KUDOS_AT);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  const done = beat >= 1;
  const cheered = beat >= 2;

  return (
    <div
      aria-hidden={!active}
      className={cn(
        "absolute w-80 transition-opacity duration-1000 ease-out",
        scene.card,
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        className={cn("rounded-2xl bg-background p-4 transition-shadow duration-500", CARD_SHADOW)}
        style={cheered ? { boxShadow: ENCOURAGED_GLOW } : undefined}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200",
              done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
            )}
          >
            <Check size={12} weight="bold" className={cn("transition-opacity duration-200", done ? "opacity-100" : "opacity-0")} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ThemedText type="larger_default">{scene.task}</ThemedText>
            {/* One fixed-height line that cross-fades through the beats, so the card never resizes. */}
            <div className="grid h-6 items-center">
              <ThemedText type="caption" className={cn("col-start-1 row-start-1 transition-opacity duration-300", done ? "opacity-0" : "opacity-100")}>
                {scene.meta}
              </ThemedText>
              <ThemedText type="caption" className={cn("col-start-1 row-start-1 transition-opacity duration-300", done && !cheered ? "opacity-100" : "opacity-0")}>
                Done just now
              </ThemedText>
              <div className={cn("col-start-1 row-start-1 flex items-center gap-2 transition-opacity duration-300", cheered ? "opacity-100" : "opacity-0")}>
                <div className="flex">
                  {scene.cheers.map((n, i) => (
                    <Avatar key={n} n={n} className={cn("size-[22px]", i > 0 && "-ml-2")} />
                  ))}
                </div>
                <ThemedText type="caption" className="text-primary">
                  Done · {scene.cheers.length} friends cheered
                </ThemedText>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("absolute", scene.bubble)}>
        <div
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-full bg-background py-2 pl-2 pr-4 transition-[opacity,transform] duration-300 ease-out",
            CARD_SHADOW,
            cheered ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <Avatar n={scene.from.photo} className="size-8 ring-0" />
          <ThemedText type="smallerDefault">
            <span className="text-muted-foreground">{scene.from.name}</span> {scene.kudos}
          </ThemedText>
          <HandsClapping size={18} weight="fill" className="text-primary" />
        </div>
      </div>
    </div>
  );
}

function Showcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(id);
  }, [index]);

  return (
    <div className="relative hidden overflow-hidden rounded-[24px] bg-black lg:block">
      {SCENES.map((s, i) => (
        <img
          key={s.photo}
          src={photo(s.photo)}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {SCENES.map((s, i) => (
        <Story key={s.photo} scene={s} active={i === index} />
      ))}

      <div className="absolute inset-x-12 bottom-12 flex gap-2">
        {SCENES.map((s, i) => (
          <button
            key={s.photo}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i === index ? "bg-white" : "bg-white/25 hover:bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Halftone corner from the home stage wash, with a glow behind it that flares now and then.
const TEXTURE_MASK = "radial-gradient(circle at 0% 100%, #000 0%, rgb(0 0 0 / 0.35) 25%, transparent 45%)";

function FormTexture() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-3 -z-10 overflow-hidden">
      <div
        data-auth-flare
        className="absolute -bottom-1/4 -left-1/4 aspect-square w-[70%]"
        style={{
          background: "radial-gradient(circle, rgb(133 77 255 / 0.14), transparent 60%)",
          animation: "auth-flare 14s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2.5px 2.5px, rgb(133 77 255 / 0.28) 1.1px, transparent 1.6px), radial-gradient(circle at 7.5px 7.5px, rgb(133 77 255 / 0.28) 1.1px, transparent 1.6px)",
          backgroundSize: "10px 10px",
          maskImage: TEXTURE_MASK,
          WebkitMaskImage: TEXTURE_MASK,
        }}
      />
    </div>
  );
}

/** Split auth layout: the form on the left, photography on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 gap-3 bg-background p-3 lg:grid-cols-2">
      <div className="relative isolate flex flex-col p-12">
        <FormTexture />
        <div className="flex items-center justify-between">
          <ThemedText type="titleFraunces" className="text-2xl">
            Kindred
          </ThemedText>
          <ThemeToggle />
        </div>

        <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">
          {children}
        </div>

      </div>

      <Showcase />
    </div>
  );
}
