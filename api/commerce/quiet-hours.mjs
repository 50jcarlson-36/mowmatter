// Recipient-local quiet hours for SMS. Offer texts outside the window are deferred to
// the next window opening, never dropped.
//
// LEGAL REVIEW REQUIRED: the default 8:00am–8:00pm window is intended to track the
// Florida Telephone Solicitation Act (recipient-local 8am–8pm) and the narrower of the
// federal TCPA calling-time rules. A lawyer must confirm the Florida and federal rules,
// whether they apply to these offer texts, and whether arrival/completion texts need
// the same treatment before this is relied on as compliance.
const DEFAULT_WINDOW = "08:00-20:00";
const DEFAULT_TIME_ZONE = "America/New_York";

const minutes = (hhmm) => {
  const m = /^([01][0-9]|2[0-4]):([0-5][0-9])$/.exec(hhmm || "");
  return m ? +m[1] * 60 + +m[2] : NaN;
};

export function validTimeZone(tz) {
  if (typeof tz !== "string" || !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// MOW_SMS_SEND_WINDOW="HH:MM-HH:MM" (recipient-local, end exclusive) and
// MOW_SMS_DEFAULT_TIMEZONE (IANA) fall back to the defaults when missing or invalid.
export function quietHoursConfig(env = process.env) {
  let [start, end] = (env.MOW_SMS_SEND_WINDOW || DEFAULT_WINDOW)
    .split("-")
    .map(minutes);
  if (!(start >= 0 && end <= 1440 && start < end))
    [start, end] = DEFAULT_WINDOW.split("-").map(minutes);
  const fallbackTimeZone = validTimeZone(env.MOW_SMS_DEFAULT_TIMEZONE)
    ? env.MOW_SMS_DEFAULT_TIMEZONE
    : DEFAULT_TIME_ZONE;
  return { start, end, fallbackTimeZone };
}

// Customer time zone when known, else the business time zone, else the configured fallback.
export function recipientTimeZone({ customer, business } = {}, fallback) {
  return [customer, business, fallback, DEFAULT_TIME_ZONE].find(validTimeZone);
}

function wallClock(date, timeZone) {
  const p = {};
  for (const { type, value } of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date))
    if (type !== "literal") p[type] = +value;
  return p;
}

const offset = (date, timeZone) => {
  const p = wallClock(date, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000
  );
};

// UTC instant for a local wall-clock time. The second pass corrects for a DST
// transition between the guess and the target.
function zonedInstant(year, month, day, minuteOfDay, timeZone) {
  const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let t = wall - offset(new Date(wall), timeZone);
  t = wall - offset(new Date(t), timeZone);
  return new Date(t);
}

// Returns null when `now` is inside the recipient's window, otherwise the next window opening.
export function nextSendTime(now, timeZone, { start, end }) {
  const p = wallClock(now, timeZone);
  const m = p.hour * 60 + p.minute;
  if (m >= start && m < end) return null;
  const day = new Date(
    Date.UTC(p.year, p.month - 1, p.day + (m >= end ? 1 : 0)),
  );
  return zonedInstant(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
    start,
    timeZone,
  );
}
