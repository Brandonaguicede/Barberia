import { supabase } from "./supabase";
export function vapidBytes(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function readyRegistration() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('No se pudo iniciar el servicio de notificaciones. Recarga la aplicación.')), 8000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function enablePush(userId: string) {
  if (
    !("serviceWorker" in navigator) || !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error(
      "Este navegador no admite notificaciones. En iPhone, instala la app en Inicio y ábrela desde allí.",
    );
  }
  // The VAPID public key is intentionally shipped to browsers; the private key stays in Supabase secrets.
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    "BDyDofDnVZJ6ljDT0pVUwTl1MzDx5AZAAJeMbV3V0kNG5fx-vm9pA2ov8teZ7ygGVJP_Tes-QkN0KwwvS_5FMYg";
  if (!key) throw new Error("Las notificaciones aún no están configuradas");
  // Called only from an explicit click, before other asynchronous work (iOS requirement).
  if (await Notification.requestPermission() !== "granted") {
    throw new Error(
      "No se concedió permiso. Puedes cambiarlo en la configuración del navegador.",
    );
  }
  const registration = await readyRegistration();
  const sub = (await registration.pushManager.getSubscription()) ||
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidBytes(key),
    });
  const data = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: data.endpoint,
    p256dh: data.keys?.p256dh,
    auth: data.keys?.auth,
  }, { onConflict: "endpoint" });
  if (error) {
    await sub.unsubscribe();
    throw new Error("No se pudo registrar el dispositivo");
  }
}
export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    const { error } = await supabase.from("push_subscriptions").delete().eq(
      "endpoint",
      sub.endpoint,
    );
    if (error) {
      throw new Error(
        "Dispositivo desactivado. No se pudo limpiar el registro del servidor.",
      );
    }
  }
}
