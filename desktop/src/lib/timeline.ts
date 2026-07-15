import type { TaskDocument } from "@/hooks/useWorkspaces";

export const HOUR_HEIGHT = 56; // px per hour
const SNAP = 15; // minutes

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
