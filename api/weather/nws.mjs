import { fail } from "../operations/access.mjs";
const valid = (n) => typeof n === "number" && Number.isFinite(n);
export function coordinates(lat, lon) {
  if (!valid(lat) || !valid(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw fail("Confirmed coordinates are required");
  return [Number(lat.toFixed(4)), Number(lon.toFixed(4))];
}
export function classifyHour(p, alerts, now = Date.now()) {
  const time = Date.parse(p.startTime),
    end = Date.parse(p.endTime);
  const reasons = [];
  const active = alerts.filter(
    (a) =>
      Date.parse(a.onset || a.effective) <= end &&
      ((!a.ends && !a.expires) || Date.parse(a.ends || a.expires) >= time),
  );
  let status = "clear";
  if (active.some((a) => ["Extreme", "Severe"].includes(a.severity))) {
    status = "blocked";
    reasons.push("Severe weather alert");
  }
  if (/thunder|lightning|snow|ice|freezing/i.test(p.shortForecast || "")) {
    status = "blocked";
    reasons.push("Forecast requires a field safety review");
  }
  const probability = p.probabilityOfPrecipitation?.value;
  const temperature =
    typeof p.temperature === "number"
      ? p.temperatureUnit === "C"
        ? (p.temperature * 9) / 5 + 32
        : p.temperature
      : null;
  const wind =
    typeof p.windSpeed === "string"
      ? Math.max(...(p.windSpeed.match(/\d+/g) || []).map(Number))
      : null;
  if (probability >= 60) {
    if (status !== "blocked") status = "review";
    reasons.push("Elevated rain probability");
  }
  if (temperature !== null && (temperature >= 95 || temperature <= 35)) {
    if (status !== "blocked") status = "review";
    reasons.push("Heat or cold planning review");
  }
  if (wind !== null && wind >= 25) {
    if (status !== "blocked") status = "review";
    reasons.push("Wind planning review");
  }
  if (
    probability == null ||
    temperature === null ||
    wind === null ||
    !Number.isFinite(time) ||
    !Number.isFinite(end)
  ) {
    if (status !== "blocked") status = "review";
    reasons.push("Forecast fields are incomplete");
  }
  if (active.length && status === "clear") {
    status = "review";
    reasons.push("Weather alert");
  }
  return {
    start: p.startTime,
    end: p.endTime,
    temperatureF: temperature,
    rainProbability: probability ?? null,
    wind: p.windSpeed || null,
    description: p.shortForecast || "",
    status,
    reasons,
  };
}
export function createNWS({
  fetcher = fetch,
  now = Date.now,
  userAgent = "MowMatter (https://mowmatter.com)",
} = {}) {
  const cache = new Map(),
    pending = new Map();
  async function get(url) {
    const u = new URL(url);
    if (u.origin !== "https://api.weather.gov")
      throw fail("Invalid weather provider URL", 502);
    const r = await fetcher(u, {
      headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok)
      throw fail(
        "Weather provider is unavailable; review the schedule manually",
        502,
      );
    return r.json();
  }
  return async function forecast(lat, lon) {
    [lat, lon] = coordinates(lat, lon);
    const key = lat + "," + lon;
    const cached = cache.get(key);
    if (cached && now() - cached.cachedAt < 300000) return cached.value;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const point = await get("https://api.weather.gov/points/" + key);
      const tz = point.properties?.timeZone;
      if (!tz || !point.properties?.forecastHourly)
        throw fail("No hourly forecast for this location", 422);
      const [f, a] = await Promise.all([
        get(point.properties.forecastHourly),
        get("https://api.weather.gov/alerts/active?point=" + key),
      ]);
      const issued = f.properties?.updated || f.properties?.generatedAt;
      const age = now() - Date.parse(issued);
      if (!Number.isFinite(age) || age < -300000 || age > 21600000)
        throw fail("Weather forecast is stale; review manually", 502);
      const alerts = (a.features || []).map((x) => {
        const p = x.properties || {};
        return {
          event: p.event,
          headline: p.headline,
          severity: p.severity,
          effective: p.effective,
          onset: p.onset,
          ends: p.ends,
          expires: p.expires,
        };
      });
      const hours = (f.properties?.periods || [])
        .filter((p) => Date.parse(p.endTime) > now())
        .slice(0, 168)
        .map((p) => classifyHour(p, alerts, now()));
      if (!hours.length) throw fail("Hourly forecast is missing", 502);
      const value = {
        provider: "National Weather Service",
        issuedAt: issued,
        retrievedAt: new Date(now()).toISOString(),
        timeZone: tz,
        hours,
        alerts,
        requiresOwnerReview: true,
        notice:
          "Forecast guidance only. Verify current conditions before field work.",
      };
      cache.set(key, { cachedAt: now(), value });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      return value;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
