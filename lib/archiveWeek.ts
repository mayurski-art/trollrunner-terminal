// The archive's "this week" box (components/Archive.tsx) covers files posted
// since the most recent Monday 8:00 am Pacific (America/Los_Angeles, so PDT
// in summer and PST in winter). At the next Monday 8:00 am it empties and
// starts filling again with whatever gets posted after that.

const TZ = "America/Los_Angeles";
const RESET_HOUR = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Pacific wall-clock parts for an instant, plus that wall clock's offset
// from UTC (ms; negative for Pacific).
function pacific(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  const y = Number(parts.year);
  const mo = Number(parts.month) - 1;
  const d = Number(parts.day);
  const h = Number(parts.hour);
  const wall = Date.UTC(y, mo, d, h, Number(parts.minute), Number(parts.second));
  return { y, mo, d, h, weekday: WEEKDAYS.indexOf(parts.weekday), offset: wall - Math.floor(ms / 1000) * 1000 };
}

// A Pacific wall-clock time → the real instant. Re-reads the offset at the
// target so a DST change inside the week doesn't shift the reset by an hour.
function fromPacificWall(wallMs: number, guessOffset: number): number {
  const guess = wallMs - guessOffset;
  return wallMs - pacific(guess).offset;
}

export function archiveWeek(now = Date.now()): { startsAt: number; endsAt: number } {
  const p = pacific(now);
  let daysBack = p.weekday; // Mon = 0
  if (daysBack === 0 && p.h < RESET_HOUR) daysBack = 7;
  const startWall = Date.UTC(p.y, p.mo, p.d - daysBack, RESET_HOUR);
  const startsAt = fromPacificWall(startWall, p.offset);
  const endsAt = fromPacificWall(startWall + 7 * DAY_MS, p.offset);
  return { startsAt, endsAt };
}
