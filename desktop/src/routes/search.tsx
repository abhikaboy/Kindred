import { useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PeopleTab } from "@/components/search/PeopleTab";
import { BlueprintsTab } from "@/components/search/BlueprintsTab";

const TABS = ["People", "Blueprints"] as const;

// Combined discovery: people (friends) and blueprints under one Search destination.
export default function SearchScreen() {
  const [tab, setTab] = useState<string>(TABS[0]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pt-6">
      <ThemedText type="titleFraunces" as="h1">
        Search
      </ThemedText>

      <div className="max-w-xs">
        <SegmentedControl options={[...TABS]} value={tab} onChange={setTab} accent />
      </div>

      {tab === "Blueprints" ? <BlueprintsTab /> : <PeopleTab />}
    </div>
  );
}
