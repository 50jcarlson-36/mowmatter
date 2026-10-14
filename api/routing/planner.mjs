import { fail } from "../operations/access.mjs";
export const minute = (value) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value || ""))
    throw fail("Use a valid time");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
};
export const clock = (value) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
// Directed road costs. Appointment times are hard constraints unless the owner
// explicitly marks that individual visit flexible for this proposal.
export function planRoute(
  jobs,
  matrix,
  { start, end, buffer = 5, flexible = [] },
) {
  const n = jobs.length,
    free = new Set(flexible);
  const duration = jobs.map((j) => {
    const v = j.planned_minutes ?? 30;
    if (!Number.isInteger(v) || v < 1 || v > 720)
      throw fail("Correct visit service durations first");
    return v;
  });
  const fixed = jobs.map((j) => minute(j.scheduled_time));
  const append = (state, i) => {
    const leg = matrix[state.last][i + 1];
    const arrival = state.time + Math.ceil(leg.seconds / 60) + buffer;
    const at = free.has(jobs[i].id) ? arrival : fixed[i];
    if (at < arrival || at + duration[i] > end) return null;
    return {
      last: i + 1,
      mask: state.mask | (1 << i),
      time: at + duration[i],
      seconds: state.seconds + leg.seconds,
      meters: state.meters + leg.meters,
      stops: [
        ...state.stops,
        {
          id: jobs[i].id,
          updated_at: jobs[i].updated_at,
          scheduled_time: clock(at),
          original_time: jobs[i].scheduled_time.slice(0, 5),
          address: jobs[i].address,
          service_minutes: duration[i],
          drive_minutes: Math.ceil(leg.seconds / 60),
          flexible: free.has(jobs[i].id),
        },
      ],
    };
  };
  const seed = {
    last: 0,
    mask: 0,
    time: start,
    seconds: 0,
    meters: 0,
    stops: [],
  };
  const finish = (s) => {
    if (!s) return null;
    const leg = matrix[s.last][0],
      returnAt = s.time + Math.ceil(leg.seconds / 60);
    if (returnAt > end) return null;
    return {
      ...s,
      seconds: s.seconds + leg.seconds,
      meters: s.meters + leg.meters,
      return_time: clock(returnAt),
    };
  };
  let original = seed;
  for (let i = 0; i < n; i++) original = original && append(original, i);
  original = finish(original);
  let states = [seed];
  for (let depth = 0; depth < n; depth++) {
    const next = [];
    for (const state of states)
      for (let i = 0; i < n; i++)
        if (!(state.mask & (1 << i))) {
          const candidate = append(state, i);
          if (candidate) next.push(candidate);
        }
    // Keep nondominated time/cost states for each visited set and last stop.
    next.sort((a, b) => a.seconds - b.seconds || a.time - b.time);
    const groups = new Map();
    states = [];
    for (const s of next) {
      const key = s.mask + ":" + s.last,
        group = groups.get(key) || [];
      if (group.some((p) => p.time <= s.time && p.seconds <= s.seconds))
        continue;
      group.push(s);
      groups.set(key, group);
      states.push(s);
      if (states.length === 2048) break;
    }
  }
  const feasible = states.map(finish).filter(Boolean);
  if (original) feasible.push(original); // Never replace a feasible baseline with a worse route.
  feasible.sort((a, b) => a.seconds - b.seconds || a.time - b.time);
  if (!feasible.length)
    throw fail(
      "No feasible route found within these hours and fixed appointments. Review visit durations, flexibility, or crew workload.",
      422,
    );
  let beforeSeconds = 0,
    beforeMeters = 0,
    last = 0;
  for (let i = 1; i <= n; i++) {
    beforeSeconds += matrix[last][i].seconds;
    beforeMeters += matrix[last][i].meters;
    last = i;
  }
  beforeSeconds += matrix[last][0].seconds;
  beforeMeters += matrix[last][0].meters;
  const best = feasible[0];
  return {
    jobs: best.stops,
    return_time: best.return_time,
    before: {
      drive_minutes: Math.ceil(beforeSeconds / 60),
      miles: Number((beforeMeters / 1609.344).toFixed(1)),
      feasible: !!original,
    },
    after: {
      drive_minutes: Math.ceil(best.seconds / 60),
      miles: Number((best.meters / 1609.344).toFixed(1)),
    },
    service_minutes: duration.reduce((a, b) => a + b, 0),
  };
}
