import webpush from "npm:web-push@3.6.7";
import { admin, json } from "../_shared/http.ts";

const allowedEndpoint = (endpoint: string) => {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && !u.username && !u.password &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".notify.windows.com") ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".push.apple.com"));
  } catch {
    return false;
  }
};
Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  if (
    req.method !== "POST" || !secret ||
    req.headers.get("authorization") !== `Bearer ${secret}`
  ) return json({ message: "Sin autorización" }, 401);
  const db = admin();
  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    const { error: reminderError } = await db.rpc("enqueue_reminders");
    if (reminderError) throw reminderError;
    const { data: jobs, error } = await db.rpc("claim_push_jobs");
    if (error) throw error;
    let sent = 0;
    const pending = jobs || [];
    for (let offset = 0; offset < pending.length; offset += 5) {
      await Promise.all(
        pending.slice(offset, offset + 5).map(async (job) => {
          const { data: sub } = await db.from("push_subscriptions").select("*")
            .eq("id", job.subscription_id).single();
          const { data: n } = await db.from("notifications").select("*").eq(
            "id",
            job.notification_id,
          ).single();
          if (!sub || !n) return;
          const { data: profile } = await db.from("profiles").select(
            "active,subscription_expires_at",
          ).eq("id", sub.user_id).single();
          // Do not deliver obsolete reminders or booking states after cancellation/rescheduling.
          const { data: a } = await db.from("appointments").select(
            "status,starts_at,barber_id",
          ).eq("id", n.appointment_id).single();
          const reminderValid = !n.kind.startsWith("reminder:") ||
            (a?.status === "confirmed" &&
              n.kind === `reminder:${new Date(a.starts_at).getTime() / 1000}`);
          try {
            if (
              !allowedEndpoint(sub.endpoint) || sub.user_id !== n.user_id ||
              !profile?.active ||
              (profile.subscription_expires_at &&
                new Date(profile.subscription_expires_at) <= new Date())
            ) throw { statusCode: 410 };
            if (reminderValid) {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({
                  title: n.title,
                  body: "Abre la agenda para consultar los detalles.",
                  url: `/admin/citas?appointment=${n.appointment_id}`,
                  tag: n.id,
                }),
                { TTL: 300, timeout: 10000 },
              );
              sent++;
            }
            await db.from("push_jobs").update({
              delivered_at: new Date().toISOString(),
              locked_at: null,
            }).eq("id", job.id);
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) {
              await db.from("push_subscriptions").delete().eq("id", sub.id);
            } else {await db.from("push_jobs").update({
                locked_at: null,
                last_error: `push:${code || "network"}`,
                available_at: new Date(
                  Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
                ).toISOString(),
                ...(job.attempts >= 6
                  ? { failed_at: new Date().toISOString() }
                  : {}),
              }).eq("id", job.id);}
          }
        }),
      );
    }
    return json({ processed: jobs?.length || 0, sent });
  } catch {
    return json({ message: "No se pudo procesar la cola" }, 500);
  }
});
