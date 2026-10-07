import { useState } from "react";
import { Stack, Users } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { PeopleTab } from "@/components/search/PeopleTab";
import { BlueprintsTab } from "@/components/search/BlueprintsTab";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "People", icon: Users },
  { id: "Blueprints", icon: Stack },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Combined discovery: one search field, with what you're searching as chips beneath it.
export default function SearchScreen() {
  const [tab, setTab] = useState<Tab>("People");

  const chips = (
    <div className="flex items-center gap-2" role="tablist">
      {TABS.map(({ id, icon: Icon }) => {
        const active = id === tab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-3 transition-colors duration-150 active:scale-[0.97]",
              active ? "bg-primary/10 text-primary" : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon size={14} weight={active ? "fill" : "regular"} />
            <ThemedText type="caption" className="text-inherit">
              {id}
            </ThemedText>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pt-6">
      <ThemedText type="titleFraunces" as="h1">
        Search
      </ThemedText>
      <div key={tab} className="animate-in fade-in duration-200">
        {tab === "Blueprints" ? <BlueprintsTab chips={chips} /> : <PeopleTab chips={chips} />}
      </div>
    </div>
  );
}
