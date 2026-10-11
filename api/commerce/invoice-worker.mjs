export function startInvoiceWorker({
  env = process.env,
  fetcher = fetch,
  interval = setInterval,
} = {}) {
  const key =
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.supabase_api_secret_key;
  if (!key) return null;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await fetcher(
        "https://pzymmsfjgspvzbivzvkx.supabase.co/functions/v1/mowmatter-invoice-delivery",
        {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: '{"action":"run"}',
          signal: AbortSignal.timeout(120000),
        },
      );
    } catch {
      /* Durable records are revisited on the next tick; uncertain sends need review. */
    } finally {
      running = false;
    }
  };
  const timer = interval(run, 5 * 60 * 1000);
  timer.unref?.();
  return timer;
}
