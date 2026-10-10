import { fail } from "../operations/access.mjs";
function localParts(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export function dailyRisk(forecast, date) {
  const hours = forecast.hours.filter((h) => {
    const p = localParts(h.start, forecast.timeZone);
    return p.date === date && p.hour >= 7 && p.hour < 18;
  });
  if (hours.length < 8)
    return { status: "review", reasons: ["Incomplete daytime forecast"] };
  const status = hours.some((h) => h.status === "blocked")
    ? "blocked"
    : hours.some((h) => h.status === "review")
      ? "review"
      : "clear";
  return {
    status,
    reasons: [...new Set(hours.flatMap((h) => h.reasons))],
    issuedAt: forecast.issuedAt,
    retrievedAt: forecast.retrievedAt,
  };
}
export async function weekWeather(jobs, forecast) {
  if (jobs.length > 150) throw fail("Review no more than 150 visits at once");
  const results = new Map(),
    keys = new Map();
  for (const job of jobs) {
    if (typeof job.latitude === "number" && typeof job.longitude === "number") {
      const key = job.latitude.toFixed(4) + "," + job.longitude.toFixed(4);
      keys.set(key, [job.latitude, job.longitude]);
    }
  }
  if (keys.size > 40)
    throw fail("Choose a smaller service area for the weekly review");
  const entries = [...keys];
  for (let i = 0; i < entries.length; i += 4)
    await Promise.all(
      entries.slice(i, i + 4).map(async ([key, coordinates]) => {
        try {
          results.set(key, await forecast(...coordinates));
        } catch {
          results.set(key, null);
        }
      }),
    );
  return jobs.map((j) => {
    const key =
      typeof j.latitude === "number" && typeof j.longitude === "number"
        ? j.latitude.toFixed(4) + "," + j.longitude.toFixed(4)
        : "";
    const f = results.get(key);
    return {
      jobId: j.id,
      address: j.address,
      date: j.service_date,
      time: j.scheduled_time,
      status: f ? dailyRisk(f, j.service_date).status : "review",
      reasons: f
        ? dailyRisk(f, j.service_date).reasons
        : [key ? "Weather unavailable" : "Confirm property coordinates"],
      unchanged: true,
    };
  });
}
