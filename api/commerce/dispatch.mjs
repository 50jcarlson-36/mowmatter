import { fail, uuid } from "../operations/access.mjs";
export async function customerServiceStatus(b, cid, customer) {
  const jobs = await b.db(
    "mow_crew_jobs?select=id,assigned_to,service_date,scheduled_time,status,cancelled_at,updated_at&company_id=eq." +
      cid +
      "&customer_id=eq." +
      customer +
      "&order=service_date.desc&limit=30",
  );
  const routes = await b
    .db("mow_dispatch_routes?select=crew_id,service_date&company_id=eq." + cid)
    .catch(() => []);
  const views = [];
  for (const job of jobs) {
    let stopsAhead = null;
    const published = routes.some(
      (r) =>
        r.crew_id === job.assigned_to && r.service_date === job.service_date,
    );
    if (published && !job.cancelled_at && job.status === "scheduled") {
      const remaining = await b.db(
        "mow_crew_jobs?select=id,route_position,scheduled_time,status&company_id=eq." +
          cid +
          "&assigned_to=eq." +
          job.assigned_to +
          "&service_date=eq." +
          job.service_date +
          "&cancelled_at=is.null&status=neq.completed&order=route_position.asc.nullslast,scheduled_time.asc,id.asc&limit=500",
      );
      const index = remaining.findIndex((j) => j.id === job.id);
      if (
        index >= 0 &&
        remaining.some((j) => ["arrived", "in_progress"].includes(j.status))
      )
        stopsAhead = index;
    }
    views.push({
      id: job.id,
      date: job.service_date,
      time: job.scheduled_time,
      status: job.cancelled_at ? "cancelled" : job.status,
      stops_ahead: stopsAhead,
    });
  }
  return { visits: views, updated_at: new Date().toISOString() };
}
export async function dispatchAction(b, user, cid, action, input) {
  if (action === "dispatch-status") {
    const [routes, notices] = await Promise.all([
      b.db(
        "mow_dispatch_routes?select=crew_id,service_date,published_at&company_id=eq." +
          cid,
      ),
      b.db(
        "mow_route_notices?select=job_id,kind,status,created_at&company_id=eq." +
          cid +
          "&order=created_at.desc&limit=100",
      ),
    ]);
    return { routes, notices };
  }
  if (
    !["move", "publish"].includes(input.command) ||
    !uuid(input.crew_id) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.service_date || "")
  )
    throw fail("Choose a crew and date");
  if (
    input.command === "move" &&
    (!uuid(input.id) ||
      !input.expected_updated_at ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.scheduled_time || ""))
  )
    throw fail("Choose a pending visit and time");
  if (
    input.command === "publish" &&
    (!Array.isArray(input.jobs) ||
      input.jobs.length < 1 ||
      input.jobs.length > 100 ||
      input.jobs.some((j) => !uuid(j.id) || !j.updated_at))
  )
    throw fail("Review the remaining route");
  return b.db("rpc/mow_dispatch_change", "POST", {
    actor: user.id,
    cid,
    command: input.command,
    payload: input,
  });
}
