# Feed ↔ Notifications Swipe Pager — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the swipe-push to Notifications with a 2-page horizontal `PagerView` in the Feed screen so the other side previews mid-swipe (Instagram-style), with Notifications lazily mounted.

**Architecture:** Extract the Notifications screen body into a reusable `NotificationsView` component (props `isActive`, `onBack`). The Feed route hosts a `PagerView` whose page 0 is the existing feed and page 1 is `NotificationsView` (lazy). The standalone `Notifications.tsx` route becomes a thin wrapper for deep links.

**Tech Stack:** React Native, expo-router, `react-native-pager-view` v8 (already used by `DatePager`).

**Testing note:** These are RN screen/native-gesture changes with no component-test harness in the repo. Verification is `bun run tsc` (type safety) plus manual run (`/run`), per existing practice. No new unit tests are added.

---

### Task 1: Extract `NotificationsView` component

**Files:**
- Create: `frontend/components/notifications/NotificationsView.tsx` (copied from the route file)
- Modify: the copy's main component signature, back button, mark-as-read effect, default export

- [ ] **Step 1:** `cp` `app/(logged-in)/(tabs)/(feed)/Notifications.tsx` → `components/notifications/NotificationsView.tsx` (preserves all sub-components, helpers, styles; `@/` imports keep resolving).
- [ ] **Step 2:** Add prop type and change the component signature:
  - `type NotificationsViewProps = { isActive: boolean; onBack: () => void };`
  - `const Notifications = () => {` → `const NotificationsView = ({ isActive, onBack }: NotificationsViewProps) => {`
- [ ] **Step 3:** Back button `onPress={() => router.dismissTo("/(logged-in)/(tabs)/(feed)/feed")}` → `onPress={onBack}`.
- [ ] **Step 4:** Replace the `useFocusEffect` mark-as-read block with an `isActive`-driven `useEffect` (keep the `hasMarkedAsRead` once-guard; reset it when `isActive` is false). Remove the now-unused `useFocusEffect` import.
- [ ] **Step 5:** `export default Notifications;` → `export default NotificationsView;`
- [ ] **Step 6:** `bun run tsc` — no new errors in `NotificationsView.tsx`.

### Task 2: Reduce the standalone route to a thin wrapper

**Files:**
- Modify: `app/(logged-in)/(tabs)/(feed)/Notifications.tsx` (replace entire body)

- [ ] **Step 1:** Replace the file with a wrapper that renders `NotificationsView` with `isActive` and a router-based back:

```tsx
import { router } from "expo-router";
import NotificationsView from "@/components/notifications/NotificationsView";

export default function NotificationsRoute() {
    return <NotificationsView isActive onBack={() => router.dismissTo("/(logged-in)/(tabs)/(feed)/feed")} />;
}
```

- [ ] **Step 2:** `bun run tsc` — clean for this route.

### Task 3: Make the Feed a 2-page pager

**Files:**
- Modify: `app/(logged-in)/(tabs)/(feed)/feed.tsx`

- [ ] **Step 1:** Imports — remove `Gesture, GestureDetector` and `runOnJS`; add `import PagerView from "react-native-pager-view";` and `import NotificationsView from "@/components/notifications/NotificationsView";`.
- [ ] **Step 2:** Remove `goToNotifications` and the `swipeToNotifications` `useMemo`.
- [ ] **Step 3:** Add `const pagerRef = useRef<PagerView>(null);`, `const [activePage, setActivePage] = useState(0);`, `const [notificationsMounted, setNotificationsMounted] = useState(false);`.
- [ ] **Step 4:** Both heart buttons (`renderHeader` ~599 and animated header ~728): `router.push(".../Notifications")` → `pagerRef.current?.setPage(1)`.
- [ ] **Step 5:** Wrap the return in `PagerView` (`initialPage={0}`, `onPageSelected` → `setActivePage`, `onPageScrollStateChanged` → set `notificationsMounted` true on `"dragging"`). Page 0 = the existing `<View style={styles.container}>` subtree with the `GestureDetector` wrapper removed (plain `FlatList`). Page 1 = lazy: `notificationsMounted ? <NotificationsView isActive={activePage === 1} onBack={() => pagerRef.current?.setPage(0)} /> : <View style={{ flex: 1, backgroundColor: ThemedColor.background }} />`.
- [ ] **Step 6:** `bun run tsc` — no new errors in `feed.tsx`.

### Task 4: Verify & commit

- [ ] **Step 1:** `bun run tsc` whole project — only pre-existing unrelated errors remain (`DatePager.tsx`).
- [ ] **Step 2:** Stage only the four touched files + this plan; commit.
- [ ] **Step 3:** Offer to run the app (`/run`) to confirm the swipe/preview.
