/** Owner-review planning heuristic, not a route solver or live dispatch action. */
const date = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw Error("Use valid company-local dates.");
  return value;
};
const minutes = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1440)
    throw Error(`Check ${label}.`);
  return value;
};
export function proposeWeek({
  jobs,
  slots,
  weather,
  now = Date.now(),
  weatherMaxAgeMinutes = 360,
}) {
  if (
    !Array.isArray(jobs) ||
    !Array.isArray(slots) ||
    !Array.isArray(weather) ||
    jobs.length > 2000 ||
    slots.length > 1000
  )
    throw Error("Invalid weekly planning inputs.");
  if (
    new Set(jobs.map((j) => j.id)).size !== jobs.length ||
    jobs.some((j) => !j.id) ||
    new Set(slots.map((s) => s.id)).size !== slots.length
  )
    throw Error("Use unique jobs and crew slots.");
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(weatherMaxAgeMinutes) ||
    weatherMaxAgeMinutes <= 0
  )
    throw Error("Check forecast freshness policy.");
  const capacity = new Map(),
    personDayCrew = new Map(),
    lastZone = new Map();
  const crewDays = new Set();
  for (const slot of slots) {
    date(slot.date);
    minutes(slot.capacityMinutes, "crew capacity");
    if (
      !slot.id ||
      !slot.crewId ||
      !Array.isArray(slot.personIds) ||
      !slot.personIds.length ||
      slot.personIds.some((id) => typeof id !== "string" || !id) ||
      new Set(slot.personIds).size !== slot.personIds.length ||
      crewDays.has(slot.crewId + ":" + slot.date)
    )
      throw Error("Verify distinct daily crew slots and personnel.");
    crewDays.add(slot.crewId + ":" + slot.date);
    capacity.set(slot.id, slot.capacityMinutes);
  }
  for (const job of jobs) {
    date(job.earliestDate);
    date(job.latestDate);
    date(job.dueDate);
    if (job.earliestDate > job.latestDate) throw Error("Check service window.");
    minutes(job.serviceMinutes, "service duration");
    minutes(job.travelMinutes, "travel allowance");
    if (
      !job.serviceMinutes ||
      !job.zoneId ||
      !Number.isFinite(job.growthPriority ?? 0) ||
      (job.growthPriority ?? 0) < 0 ||
      (job.growthPriority ?? 0) > 3
    )
      throw Error("Confirm service and growth assumptions.");
  }
  const proposals = [],
    exceptions = [];
  let unknownLocks = false;
  for (const job of jobs.filter((j) => j.locked === true)) {
    const slot = slots.find((s) => s.id === job.lockedSlotId);
    if (!slot) {
      unknownLocks = true;
      continue;
    }
    const remaining =
      capacity.get(slot.id) - job.serviceMinutes - job.travelMinutes;
    if (remaining < 0) unknownLocks = true;
    capacity.set(slot.id, Math.max(0, remaining));
    for (const id of slot.personIds) {
      const key = slot.date + ":" + id;
      if (personDayCrew.has(key) && personDayCrew.get(key) !== slot.crewId)
        unknownLocks = true;
      personDayCrew.set(key, slot.crewId);
    }
  }
  const sorted = [...jobs].sort(
    (a, b) =>
      a.latestDate.localeCompare(b.latestDate) ||
      (b.growthPriority ?? 0) - (a.growthPriority ?? 0) ||
      a.dueDate.localeCompare(b.dueDate) ||
      String(a.id).localeCompare(String(b.id)),
  );
  for (const job of sorted) {
    if (job.locked === true) {
      exceptions.push({
        jobId: job.id,
        reason: "locked_visit_review",
        detail: "Keep confirmed appointment; review changes separately.",
      });
      continue;
    }
    if (unknownLocks) {
      exceptions.push({
        jobId: job.id,
        reason: "locked_commitment_review",
        detail:
          "Resolve missing or conflicting confirmed-visit reservations before adding work.",
      });
      continue;
    }
    const candidates = slots.filter(
      (s) =>
        s.date >= job.earliestDate &&
        s.date <= job.latestDate &&
        s.personnelVerified === true &&
        s.blocked !== true &&
        (!job.allowedCrewIds || job.allowedCrewIds.includes(s.crewId)) &&
        (job.requiredSkills || []).every((skill) =>
          (s.skills || []).includes(skill),
        ),
    );
    let forecastReview = false,
      weatherBlocked = false,
      capacityBlocked = false;
    const feasible = candidates
      .filter((s) => {
        const forecasts = weather.filter(
          (w) => w.zoneId === job.zoneId && w.date === s.date,
        );
        if (forecasts.length !== 1) {
          forecastReview = true;
          return false;
        }
        const w = forecasts[0],
          fetched = Date.parse(w.fetchedAt);
        if (
          !Number.isFinite(fetched) ||
          fetched > now ||
          now - fetched > weatherMaxAgeMinutes * 60000 ||
          !["clear", "review", "blocked"].includes(w.status) ||
          w.status === "review"
        ) {
          forecastReview = true;
          return false;
        }
        if (w.status === "blocked") {
          weatherBlocked = true;
          return false;
        }
        if (
          job.serviceMinutes + job.travelMinutes > capacity.get(s.id) ||
          s.personIds.some(
            (id) =>
              personDayCrew.has(s.date + ":" + id) &&
              personDayCrew.get(s.date + ":" + id) !== s.crewId,
          )
        ) {
          capacityBlocked = true;
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          Number(lastZone.get(b.id) === job.zoneId) -
            Number(lastZone.get(a.id) === job.zoneId) ||
          String(a.id).localeCompare(String(b.id)),
      );
    const slot = feasible[0];
    if (!slot) {
      exceptions.push({
        jobId: job.id,
        reason: forecastReview
          ? "weather_review"
          : weatherBlocked
            ? "weather_blocked"
            : capacityBlocked
              ? "capacity_conflict"
              : "no_eligible_crew",
        detail:
          "Owner action required; this service obligation has not been removed.",
      });
      continue;
    }
    capacity.set(
      slot.id,
      capacity.get(slot.id) - job.serviceMinutes - job.travelMinutes,
    );
    slot.personIds.forEach((id) =>
      personDayCrew.set(slot.date + ":" + id, slot.crewId),
    );
    lastZone.set(slot.id, job.zoneId);
    proposals.push({
      jobId: job.id,
      date: slot.date,
      crewId: slot.crewId,
      slotId: slot.id,
      zoneId: job.zoneId,
      personIds: [...slot.personIds],
      serviceMinutes: job.serviceMinutes,
      travelMinutes: job.travelMinutes,
      late: slot.date > job.dueDate,
      status: "owner_review",
    });
  }
  return {
    status: "owner_review",
    proposals,
    exceptions,
    coverage: {
      due: jobs.length,
      proposed: proposals.length,
      needsAction: exceptions.length,
      late: proposals.filter((p) => p.late).length,
    },
    remainingCapacity: [...capacity].map(([slotId, minutes]) => ({
      slotId,
      minutes,
    })),
    limitations: [
      "Daily heuristic only; hourly weather windows, appointment locks, route geometry and travel matrices must be validated before dispatch.",
      "Growth priority never changes contracted cadence or billing.",
    ],
  };
}
