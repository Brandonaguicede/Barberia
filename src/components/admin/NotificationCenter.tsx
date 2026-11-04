import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import toast from "../../services/toast";
import { supabase } from "../../services/supabase";
import { disablePush, enablePush } from "../../services/push";
import { useAuth } from "../../context/AuthContext";
import styles from "./NotificationCenter.module.css";
interface Notice {
  id: string;
  title: string;
  appointment_id: string;
  read_at: string | null;
  created_at: string;
}
export default function NotificationCenter() {
  const { user } = useAuth(),
    [items, setItems] = useState<Notice[]>([]),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installedAsApp = window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window &&
    "Notification" in window;
  const needsIosInstall = iosDevice && !installedAsApp;
  const permissionDenied = "Notification" in window && Notification.permission === "denied";
  useEffect(() => {
    if (!user) return;
    let live = true;
    const load = async () => {
      const { data, error } = await supabase.from("notifications").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(
          30,
        );
      if (live) {
        if (error) setError("No se pudieron cargar los avisos");
        else {
          setItems(data || []);
          setError("");
        }
      }
    };
    void load();
    if ("serviceWorker" in navigator && "PushManager" in window) {
      void navigator.serviceWorker.ready.then((r) =>
        r.pushManager.getSubscription()
      ).then((s) => {
        if (live) setEnabled(Boolean(s));
      });
    }
    const channel = supabase.channel(`notifications:${user.id}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        toast(payload.new.title);
        void load();
        window.dispatchEvent(new Event("appointments:changed"));
      },
    ).subscribe();
    // Polling recovers missed events after reconnect or mobile suspension.
    const timer = setInterval(() => void load(), 60000);
    return () => {
      live = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [user]);
  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (enabled) await disablePush();
      else await enablePush(user.id);
      setEnabled(!enabled);
      toast.success(
        enabled
          ? "Notificaciones desactivadas en este dispositivo"
          : "Notificaciones activadas",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const read = async (id: string) => {
    const { error } = await supabase.from("notifications").update({
      read_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setItems((v) =>
        v.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    }
  };
  const unreadCount = items.filter((n) => !n.read_at).length;
  return (
    <details className={`notification-center ${styles.center}`}>
      <summary aria-label={`Avisos, ${unreadCount} sin leer`}><Bell size={19} aria-hidden="true" /><span className={styles.summaryText}>Avisos ({unreadCount})</span>{unreadCount > 0 && <span className={styles.badge} aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</summary>
      <div className={styles.popover}>
      <h2 className={styles.popoverTitle}>Avisos</h2>
      {needsIosInstall ? <section className={styles.installGuide} aria-labelledby="ios-push-guide-title">
        <h3 id="ios-push-guide-title">Activa las notificaciones en tu iPhone</h3>
        <ol>
          <li>En Safari, toca <strong>Compartir</strong>.</li>
          <li>Elige <strong>A&#241;adir a pantalla de inicio</strong> y confirma.</li>
          <li>Abre Tenorio Barber desde el nuevo &#237;cono.</li>
          <li>Vuelve aqu&#237;, toca <strong>Activar notificaciones</strong> y permite los avisos.</li>
        </ol>
        <p>Requiere iOS o iPadOS 16.4 o posterior.</p>
      </section> : !pushSupported ? <p className={styles.supportNotice}>Este navegador no ofrece notificaciones web. Prueba con Safari, Chrome o Edge actualizado.</p> : permissionDenied && !enabled ? <p className={styles.supportNotice}>El permiso est&#225; bloqueado. C&#225;mbialo en la configuraci&#243;n de notificaciones de este sitio y vuelve a intentarlo.</p> : <button
        type="button"
        className="action-button"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy
          ? "Actualizando\u2026"
          : enabled
          ? "Desactivar notificaciones"
          : "Activar notificaciones"}
      </button>}
      {error && <p role="alert">{error}</p>}
      {items.length === 0 && <p>No tienes avisos.</p>}
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            <Link
              to={`/admin/citas?appointment=${n.appointment_id}`}
              onClick={() => void read(n.id)}
            >
              {!n.read_at && "• "}
              {n.title}{" "}
              <small>
                {new Date(n.created_at).toLocaleString("es-CR", {
                  timeZone: "America/Costa_Rica",
                })}
              </small>
            </Link>
          </li>
        ))}
      </ul>
      </div>
    </details>
  );
}
