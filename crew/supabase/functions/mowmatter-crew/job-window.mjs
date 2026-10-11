export function jobWindow(body, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const shift = (days) =>
    new Date(Date.parse(today + "T12:00:00Z") + days * 86400000)
      .toISOString()
      .slice(0, 10);
  const from = body.from_date || shift(-7),
    to = body.to_date || shift(35);
  for (const date of [from, to])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
    )
      throw Error("Choose valid job dates");
  if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 62)
    throw Error("Choose a job window up to 62 days");
  const cursor = body.cursor;
  if (
    cursor &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) ||
      !/^\d{2}:\d{2}:\d{2}$/.test(cursor.time) ||
      !/^[a-f0-9-]{36}$/i.test(cursor.id))
  )
    throw Error("Invalid job cursor");
  return { from, to, cursor };
}
export const canAccessJob = (member, job) =>
  member.company_id === job.company_id &&
  (member.role === "owner" ||
    job.assigned_to === member.user_id ||
    (member.role === "lead" &&
      !!member.crew_id &&
      member.crew_id === job.crew_id));
