/** Utilities for IRPF season goals: week generation and date math. */

export function parseISODate(s: string): Date {
  // "YYYY-MM-DD" -> local midnight
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

export function formatBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatBRFull(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Generates weekly buckets from start to deadline (inclusive).
 * Each bucket is up to 7 days. Last bucket is clipped to the deadline.
 */
export function generateWeeks(startISO: string, deadlineISO: string): Array<{
  week_number: number;
  week_start: string;
  week_end: string;
}> {
  const start = parseISODate(startISO);
  const deadline = parseISODate(deadlineISO);
  if (deadline < start) return [];
  const weeks: Array<{ week_number: number; week_start: string; week_end: string }> = [];
  let cursor = start;
  let n = 1;
  while (cursor <= deadline) {
    const candidateEnd = addDays(cursor, 6);
    const end = candidateEnd > deadline ? deadline : candidateEnd;
    weeks.push({
      week_number: n,
      week_start: toISODate(cursor),
      week_end: toISODate(end),
    });
    cursor = addDays(end, 1);
    n++;
  }
  return weeks;
}

/** Distribute total evenly across weeks (last week absorbs remainder). */
export function distributeGoals(total: number, weekCount: number): number[] {
  if (weekCount <= 0) return [];
  const base = Math.floor(total / weekCount);
  const remainder = total - base * weekCount;
  const out = Array(weekCount).fill(base);
  // distribute remainder to last weeks (final stretch)
  for (let i = 0; i < remainder; i++) {
    out[weekCount - 1 - i] += 1;
  }
  return out;
}
