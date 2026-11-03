import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "../../services/toast";
import { supabase } from "../../services/supabase";
import { disablePush, enablePush } from "../../services/push";
import { useAuth } from "../../context/AuthContext";
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
      toast.error((e as Error).message);
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
  return (
    <details className="notification-center">
      <summary>Avisos ({items.filter((n) => !n.read_at).length})</summary>
      <button
        className="action-button"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy
          ? "Actualizando…"
          : enabled
          ? "Desactivar notificaciones"
          : "Activar notificaciones"}
      </button>
      <p className="muted">
        En iPhone: añade esta app a Inicio y ábrela desde su icono para activar
        los avisos.
      </p>
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
    </details>
  );
}
