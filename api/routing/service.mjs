import { createHmac, timingSafeEqual } from "node:crypto";
import { fail, uuid } from "../operations/access.mjs";
import { minute, planRoute } from "./planner.mjs";
import { roadMatrix } from "./google.mjs";
export function createRouting({
  backend: b,
  env = process.env,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  const key = env.GOOGLE_ROUTES_API_KEY;
  const secret =
    env.ROUTE_SIGNING_SECRET ||
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.supabase_api_secret_key;
  const available = () =>
    Boolean(key && secret && env.MOW_ROUTING_ENABLED === "true");
  const sign = (s) =>
    createHmac("sha256", secret)
      .update("mow-route-v1:" + s)
      .digest("base64url");
  return async (user, cid, action, input) => {
    if (action === "route-capabilities")
      return {
        available: available(),
        max_stops: 12,
        provider: "Google Maps",
        traffic: "Typical road travel; live traffic excluded",
      };
    if (!available())
      throw fail(
        "Route optimization needs Google Routes API activation. Manual dispatch remains available.",
        503,
      );
    if (action === "route-publish") {
      if (
        input.confirm_review !== true ||
        typeof input.proposal !== "string" ||
        input.proposal.length > 10000
      )
        throw fail(
          "Review the route and appointment changes before publishing",
        );
      const [raw, mac, ...extra] = input.proposal.split("."),
        expected = sign(raw);
      if (
        extra.length ||
        !mac ||
        mac.length !== expected.length ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
      )
        throw fail("Invalid route proposal", 400);
      let p;
      try {
        p = JSON.parse(Buffer.from(raw, "base64url").toString());
      } catch {
        throw fail("Invalid route proposal");
      }
      if (p.cid !== cid || p.actor !== user.id || p.expires < now())
        throw fail(
          "Route preview expired or belongs to another account. Calculate again.",
          409,
        );
      return b.db("rpc/mow_route_plan_publish", "POST", {
        actor: user.id,
        cid,
        payload: p,
      });
    }
    if (action !== "route-optimize") throw fail("Unknown routing action", 404);
    if (
      !uuid(input.crew_id) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.service_date || "")
    )
      throw fail("Choose a crew and date");
    if (
      !Number.isFinite(Date.parse(input.service_date)) ||
      new Date(input.service_date + "T00:00:00Z").toISOString().slice(0, 10) !==
        input.service_date
    )
      throw fail("Choose a valid date");
    let today;
    try {
      today = new Intl.DateTimeFormat("en-CA", {
        timeZone: input.time_zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now());
    } catch {
      throw fail("Choose a business time zone");
    }
    if (
      !input.time_zone ||
      input.service_date < today ||
      Date.parse(input.service_date) > now() + 30 * 86400000
    )
      throw fail("Plan today through the next 30 days");
    const start = minute(input.start_time),
      end = minute(input.end_time);
    if (end <= start || end - start > 840)
      throw fail("Choose a workday of up to 14 hours");
    if (input.service_date === today) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: input.time_zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now());
      if (start < minute(parts))
        throw fail("Choose a departure time that has not passed");
    }
    if (
      typeof input.depot !== "string" ||
      input.depot.trim().length < 10 ||
      input.depot.length > 300
    )
      throw fail("Enter the full starting and return address");
    if (
      !Array.isArray(input.flexible_ids) ||
      input.flexible_ids.some((id) => !uuid(id)) ||
      new Set(input.flexible_ids).size !== input.flexible_ids.length
    )
      throw fail("Review flexible visits");
    const members = await b.db(
      "mow_crew_members?select=user_id&company_id=eq." +
        cid +
        "&user_id=eq." +
        input.crew_id,
    );
    if (!members.length) throw fail("Choose a crew in this business", 403);
    const jobs = await b.db(
      "mow_crew_jobs?select=id,address,scheduled_time,planned_minutes,status,updated_at,route_position&company_id=eq." +
        cid +
        "&assigned_to=eq." +
        input.crew_id +
        "&service_date=eq." +
        input.service_date +
        "&cancelled_at=is.null&status=neq.completed&order=route_position.asc.nullslast,scheduled_time.asc,id.asc&limit=13",
    );
    if (jobs.length < 2 || jobs.length > 12)
      throw fail("Choose a route with 2–12 remaining visits");
    if (jobs.some((j) => j.status !== "scheduled"))
      throw fail(
        "Resolve blocked visits and finish work underway before planning. This planner is for crews before departure.",
      );
    if (
      jobs.some(
        (j) =>
          typeof j.address !== "string" ||
          j.address.trim().length < 10 ||
          j.address.length > 300,
      )
    )
      throw fail("Add a full street address to every visit");
    if (input.flexible_ids.some((id) => !jobs.some((j) => j.id === id)))
      throw fail("Visit list changed. Refresh and review again.", 409);
    if (!(await b.db("rpc/mow_route_reserve", "POST", { actor: user.id, cid })))
      throw fail(
        "Routing request limit reached. Wait at least 30 seconds; each business has 20 calculations per UTC day.",
        429,
      );
    const matrix = await roadMatrix(
      [input.depot.trim(), ...jobs.map((j) => j.address)],
      { key, fetcher },
    );
    const result = planRoute(jobs, matrix, {
      start,
      end,
      flexible: input.flexible_ids,
    });
    const p = {
      cid,
      actor: user.id,
      crew_id: input.crew_id,
      service_date: input.service_date,
      time_zone: input.time_zone,
      jobs: result.jobs.map(({ id, updated_at, scheduled_time, flexible }) => ({
        id,
        updated_at,
        scheduled_time,
        flexible,
      })),
      expires: now() + 15 * 60000,
    };
    const raw = Buffer.from(JSON.stringify(p)).toString("base64url");
    return {
      ...result,
      proposal: raw + "." + sign(raw),
      expires_at: new Date(p.expires).toISOString(),
      provider: "Google Maps",
      notice:
        "Estimated road travel, without live traffic. Includes return to your start address and a 5-minute buffer before each visit. Fixed appointments are preserved. Review access, weather and breaks before publishing.",
    };
  };
}
