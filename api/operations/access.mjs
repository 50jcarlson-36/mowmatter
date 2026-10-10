export const BASE = "https://pzymmsfjgspvzbivzvkx.supabase.co";
export const PUBLIC_KEY = "sb_publishable_KQGD-vWlAlJi_Bv7fSaEvA_YLJpIgyu";
export const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
export const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function jsonBody(req, max = 300000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += Buffer.byteLength(c);
    if (size > max) throw fail("Request too large", 413);
    chunks.push(Buffer.from(c));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw fail("Invalid JSON");
  }
}
export function backend({ env = process.env, fetcher = fetch } = {}) {
  const key =
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.supabase_api_secret_key;
  const headers = () => {
    if (!key) throw fail("Database connection is not configured", 503);
    return {
      apikey: key,
      ...(key.startsWith("sb_secret_")
        ? {}
        : { Authorization: "Bearer " + key }),
      "Content-Type": "application/json",
    };
  };
  async function db(path, method = "GET", body) {
    const r = await fetcher(BASE + "/rest/v1/" + path, {
      method,
      headers: { ...headers(), Prefer: "return=representation" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw fail("Database action could not finish", 503);
    return r.status === 204 ? null : r.json();
  }
  async function user(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw fail("Sign in to continue", 401);
    const r = await fetcher(BASE + "/auth/v1/user", {
      headers: { apikey: PUBLIC_KEY, Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw fail("Sign in again", 401);
    const u = await r.json();
    if (!uuid(u.id)) throw fail("Invalid session", 401);
    return u;
  }
  async function owner(req, cid) {
    const u = await user(req);
    if (!uuid(cid)) throw fail("Choose a business");
    const rows = await db(
      "mow_crew_members?select=company_id,role&company_id=eq." +
        cid +
        "&user_id=eq." +
        u.id +
        "&role=eq.owner",
    );
    if (!rows.length) throw fail("Business owner access required", 403);
    return u;
  }
  return { db, user, owner, headers, fetcher };
}
