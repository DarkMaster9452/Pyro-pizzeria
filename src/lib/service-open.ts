import "server-only";
import { sql } from "./db";
import { RESTAURANTS } from "./data";

// Today's Bratislava calendar date, used to read the manual daily-open flag.
const SERVICE_DATE = "(now() AT TIME ZONE 'Europe/Bratislava')::date";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Current weekday (0 = Monday … 6 = Sunday) and minutes-since-midnight in the
// Europe/Bratislava timezone, matching the seed opening-hours format.
function bratislavaNow(): { weekdayIdx: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bratislava",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const min = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  };
  return { weekdayIdx: map[wd] ?? 0, minutes: hour * 60 + min };
}

// Whether the restaurant is currently open for service: the manual daily-open
// flag is set for today AND the closing time has not passed yet. Used to size
// staff login sessions (longer while the shop is open). Fails closed on error.
export async function isRestaurantOpenNow(
  restaurantId: string | null | undefined
): Promise<boolean> {
  if (!restaurantId) return false;
  try {
    const rows = (await sql.query(
      `SELECT COALESCE(open_date = ${SERVICE_DATE}, false) AS is_open
       FROM restaurant_state WHERE id = $1 LIMIT 1`,
      [restaurantId]
    )) as { is_open: boolean }[];
    if (!rows[0]?.is_open) return false;
    const { weekdayIdx, minutes } = bratislavaNow();
    const r = RESTAURANTS.find((x) => x.id === restaurantId);
    const today = r?.openingHours.find((h) => h.day === weekdayIdx);
    if (!today) return false;
    return minutes < toMinutes(today.close);
  } catch {
    return false;
  }
}
