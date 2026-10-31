/**
 * The site's only server code: POST /api/waitlist adds an email to the D1 database.
 * Everything else is static and served by Cloudflare before this runs (see wrangler.jsonc).
 */
interface Env {
  DB: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
  WAITLIST_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 2048;

const reply = (status: number, body: Record<string, unknown>, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

async function join(request: Request, env: Env) {
  // Only this site's own form, not other pages posting on a visitor's behalf.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host) return reply(403, { error: "forbidden" });

  const { success } = await env.WAITLIST_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" });
  if (!success) return reply(429, { error: "slow_down" });

  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413, { error: "too_large" });
  let body: { email?: unknown; website?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "invalid_email" });
  }
  // The form's hidden field: people never see it, bots fill it in. They get the same answer as everyone.
  if (body.website) return reply(200, { ok: true });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return reply(400, { error: "invalid_email" });

  // Same answer whether or not they're already on the list, so nobody can test who has signed up.
  await env.DB.prepare("INSERT OR IGNORE INTO waitlist (email) VALUES (?)").bind(email).run();
  return reply(200, { ok: true });
}

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== "/api/waitlist") return reply(404, { error: "not_found" });
    if (request.method !== "POST") return reply(405, { error: "method_not_allowed" }, { allow: "POST" });
    try {
      return await join(request, env);
    } catch (error) {
      console.error("waitlist", error);
      return reply(500, { error: "server_error" });
    }
  },
};
