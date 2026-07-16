import type { TaskDocument } from "@/hooks/useWorkspaces";

export const HOUR_HEIGHT = 56; // px per hour
export const SNAP = 15; // minutes

export const minutesToY = (minutes: number): number => (minutes / 60) * HOUR_HEIGHT;

export function yToMinutes(y: number): number {
  const raw = (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(raw / SNAP) * SNAP;
  return Math.max(0, Math.min(1439, snapped));
}

export const nowMinutes = (now: Date = new Date()): number => now.getHours() * 60 + now.getMinutes();

function minutesInDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function layoutTimedTask(task: TaskDocument, _day: Date): { top: number; height: number } {
  const startMin = task.startTime ? minutesInDay(task.startTime) : 0;
  const endMin =
    task.deadline && task.startTime && new Date(task.deadline) > new Date(task.startTime)
      ? minutesInDay(task.deadline)
      : startMin + 60;
  return { top: minutesToY(startMin), height: Math.max(minutesToY(15), minutesToY(endMin - startMin)) };
}

export type PlacedEvent = { task: TaskDocument; top: number; height: number; leftPct: number; widthPct: number };

// Pack a day's timed tasks into side-by-side lanes (Google Calendar style): events
// that overlap in time share a cluster whose width splits evenly across its lanes;
// non-overlapping events reuse a lane and stay full width.
export function layoutDayEvents(tasks: TaskDocument[], day: Date): PlacedEvent[] {
  const items = tasks
    .map((task) => {
      const { top, height } = layoutTimedTask(task, day);
      return { task, top, bottom: top + height, height };
    })
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  const out: PlacedEvent[] = [];
  let group: { item: (typeof items)[number]; lane: number }[] = [];
  let laneEnds: number[] = []; // last event bottom per lane in the current cluster
  let clusterBottom = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const g of group) {
      out.push({ task: g.item.task, top: g.item.top, height: g.item.height, leftPct: g.lane / lanes, widthPct: 1 / lanes });
    }
    group = [];
    laneEnds = [];
    clusterBottom = -Infinity;
  };

  for (const item of items) {
    if (group.length && item.top >= clusterBottom) flush(); // no overlap with the cluster
    let lane = laneEnds.findIndex((end) => end <= item.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.bottom);
    } else {
      laneEnds[lane] = item.bottom;
    }
    group.push({ item, lane });
    clusterBottom = Math.max(clusterBottom, item.bottom);
  }
  flush();
  return out;
}

// New start minute when dragging the top edge by deltaPx; kept at least SNAP before the end.
export function resizeStart(topPx: number, heightPx: number, deltaPx: number): number {
  const endMin = yToMinutes(topPx + heightPx);
  const startMin = yToMinutes(topPx + deltaPx);
  return Math.min(startMin, endMin - SNAP);
}

// New end minute when dragging the bottom edge by deltaPx; kept at least SNAP after the start.
export function resizeEnd(topPx: number, heightPx: number, deltaPx: number): number {
  const startMin = yToMinutes(topPx);
  const endMin = yToMinutes(topPx + heightPx + deltaPx);
  return Math.max(endMin, startMin + SNAP);
}

// ISO for a given minute-of-day on the same calendar day as `dayIso`.
export function minuteToIsoOnDay(dayIso: string, minute: number): string {
  const d = new Date(dayIso);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d.toISOString();
}

// Move a task's start to `startMin` on `day`, preserving its duration if it had one.
export function rescheduleToStart(
  task: TaskDocument,
  day: Date,
  startMin: number
): { startTime: string; startDate: string; deadline?: string } {
  const start = new Date(day);
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  const iso = start.toISOString();
  const out: { startTime: string; startDate: string; deadline?: string } = { startTime: iso, startDate: iso };
  if (task.startTime && task.deadline) {
    const durMs = new Date(task.deadline).getTime() - new Date(task.startTime).getTime();
    if (durMs > 0) out.deadline = new Date(start.getTime() + durMs).toISOString();
  }
  return out;
}
