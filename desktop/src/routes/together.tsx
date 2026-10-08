import { useState } from "react";
import { Stack, Users } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { PeopleTab } from "@/components/search/PeopleTab";
import { BlueprintsTab } from "@/components/search/BlueprintsTab";
import { FriendsClosedToday } from "@/components/together/FriendsClosedToday";
import { SupportersWidget } from "@/components/activity/SupportersWidget";
import { KudosEffectWidget } from "@/components/activity/KudosEffectWidget";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "People", icon: Users },
  { id: "Blueprints", icon: Stack },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Together: find and add people, then who did things alongside you. Never names inactive friends.
export default function TogetherScreen() {
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
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 pt-6">
      <div className="flex flex-col gap-1">
        <ThemedText type="titleFraunces" as="h1">
          Together
        </ThemedText>
        <ThemedText type="caption">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </ThemedText>
      </div>
      <div key={tab} className="animate-in fade-in duration-200">
        {tab === "Blueprints" ? (
          <BlueprintsTab chips={chips} />
        ) : (
          <PeopleTab chips={chips}>
            <TogetherSections />
          </PeopleTab>
        )}
      </div>
    </div>
  );
}

function TogetherSections() {
  const analytics = $api.useQuery("get", "/v1/user/analytics", { params: { query: { range: "month" } } });
  const data = analytics.data;

  return (
    <>
      <FriendsClosedToday />
      {data && data.topSupporters?.length ? (
        <SupportersWidget supporters={data.topSupporters} coverage={data.supportCoverage} />
      ) : null}
      {data?.kudosEffect.hasComparison ? <KudosEffectWidget effect={data.kudosEffect} /> : null}
    </>
  );
}
