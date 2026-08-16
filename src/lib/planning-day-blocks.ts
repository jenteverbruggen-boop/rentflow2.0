import { format } from "date-fns";

const AXIS_START_HOUR = 8;
const AXIS_END_HOUR = 24;

export interface DayBlockPeriod {
  id: number;
  projectId: number;
  projectName: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface DayBlock {
  key: string;
  projectId: number;
  projectName: string;
  status: string;
  topPct: number;
  heightPct: number;
  clampedStart: boolean;
  clampedEnd: boolean;
  label: string;
}

/**
 * I1.3 — positions each period touching `day` on an 08:00–24:00 axis,
 * sized by its actual start/end times. A period starting before 08:00
 * or ending after midnight is clamped to the visible axis with a
 * flagged indicator (`clampedStart`/`clampedEnd`) — it renders as a
 * thin sliver rather than being silently hidden. `label` always shows
 * the real, unclamped times.
 */
export function computeDayBlocks(day: Date, periods: DayBlockPeriod[]): DayBlock[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  const axisStart = new Date(y, m, d, AXIS_START_HOUR, 0, 0);
  const axisEnd = new Date(y, m, d, AXIS_END_HOUR, 0, 0);
  const dayFullStart = new Date(y, m, d, 0, 0, 0);
  const dayFullEnd = new Date(y, m, d + 1, 0, 0, 0);
  const totalMs = axisEnd.getTime() - axisStart.getTime();

  const blocks: DayBlock[] = [];
  for (const period of periods) {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    if (end <= dayFullStart || start >= dayFullEnd) continue; // doesn't touch this calendar day

    const clampedStart = start < axisStart;
    const clampedEnd = end > axisEnd;
    const blockStart = clampedStart ? axisStart : start > axisEnd ? axisEnd : start;
    const blockEnd = clampedEnd ? axisEnd : end < axisStart ? axisStart : end;

    blocks.push({
      key: `${period.projectId}-${period.id}`,
      projectId: period.projectId,
      projectName: period.projectName,
      status: period.status,
      topPct: ((blockStart.getTime() - axisStart.getTime()) / totalMs) * 100,
      heightPct: Math.max(1.5, ((blockEnd.getTime() - blockStart.getTime()) / totalMs) * 100),
      clampedStart,
      clampedEnd,
      label: `${format(start, "HH:mm")}–${format(end, "HH:mm")}`,
    });
  }
  return blocks;
}
