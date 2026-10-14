import { fail } from "../operations/access.mjs";
export async function roadMatrix(addresses, { key, fetcher = fetch }) {
  const points = addresses.map((address) => ({ waypoint: { address } }));
  let r;
  try {
    r = await fetcher(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,status,condition",
        },
        body: JSON.stringify({
          origins: points,
          destinations: points,
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch {
    throw fail(
      "Road travel lookup timed out. Your existing route has not changed.",
      503,
    );
  }
  if (!r.ok)
    throw fail(
      "Road travel provider is unavailable. Check Routes API activation, billing, and key restrictions.",
      503,
    );
  const entries = await r.json(),
    n = points.length,
    matrix = Array.from({ length: n }, () => Array(n).fill(null));
  if (!Array.isArray(entries)) throw fail("Invalid road travel response", 503);
  for (const row of entries) {
    const i = row.originIndex ?? 0,
      j = row.destinationIndex ?? 0;
    if (
      !Number.isInteger(i) ||
      !Number.isInteger(j) ||
      i < 0 ||
      j < 0 ||
      i >= n ||
      j >= n ||
      matrix[i][j]
    )
      throw fail("Incomplete road travel response", 503);
    const seconds = Number(String(row.duration || "").replace(/s$/, "")),
      meters = row.distanceMeters ?? (i === j ? 0 : NaN);
    if (
      row.condition !== "ROUTE_EXISTS" ||
      (row.status?.code || 0) !== 0 ||
      !/^\d+(\.\d+)?s$/.test(row.duration || "") ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      !Number.isFinite(meters) ||
      meters < 0
    )
      throw fail(
        "A road connection could not be verified. Check full street addresses and service area.",
        422,
      );
    matrix[i][j] = { seconds, meters };
  }
  if (matrix.some((row) => row.some((cell) => !cell)))
    throw fail("Incomplete road travel response. Try again.", 503);
  return matrix;
}
