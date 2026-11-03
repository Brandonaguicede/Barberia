import { createClient } from "npm:@supabase/supabase-js@2.116.0";

export const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
export const origin = () =>
  Deno.env.get("APP_ORIGIN") || "http://localhost:5173";
export const headers = () => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin(),
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
});
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}
export function preflight(req: Request) {
  if (req.headers.get("origin") && req.headers.get("origin") !== origin()) {
    return json({ message: "Origen no permitido" }, 403);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers() });
  }
  if (req.method !== "POST") {
    return json({ message: "Método no permitido" }, 405);
  }
  return null;
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Solicitud vacía");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new Error("Solicitud demasiado grande");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const data = new TextDecoder().decode(bytes);
  const value = JSON.parse(data);
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Solicitud inválida");
  }
  return value;
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function token() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function limit(req: Request, scope: string, maximum = 30) {
  // Supabase gateway supplies x-forwarded-for. Never store raw IPs or bearer tokens.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const secret = Deno.env.get("RATE_LIMIT_SECRET");
  if (!secret) throw new Error("El servidor requiere configuración de límites");
  const key = await hash(
    `${secret}:${scope}:${scope.startsWith("private:") ? "token" : ip}`,
  );
  const { data, error } = await admin().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: maximum,
    p_seconds: 600,
  });
  if (error || !data) {
    throw new Error("Demasiados intentos. Intenta más tarde.");
  }
}
export async function requireAdmin(req: Request) {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!jwt) throw new Error("Sin autorización");
  const db = admin();
  const { data: { user }, error } = await db.auth.getUser(jwt);
  if (error || !user) throw new Error("Sin autorización");
  const { data: profile } = await db.from("profiles").select(
    "active,subscription_expires_at",
  ).eq("id", user.id).single();
  const { data: role } = await db.from("user_roles").select("role").eq(
    "user_id",
    user.id,
  ).single();
  if (
    role?.role !== "admin" || !profile?.active ||
    (profile.subscription_expires_at &&
      new Date(profile.subscription_expires_at) <= new Date())
  ) throw new Error("Sin autorización");
  return user;
}
